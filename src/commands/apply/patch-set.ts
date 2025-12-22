import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { getSortedFolders } from "~/lib/fs";
import type { ApplyFlags } from "./flags";
import { applyPatch, collectPatchToApplys } from "./patch";

export type PatchSetStats = {
  name: string;
  fileCount: number;
  errors: Array<{ file: string; error: string }>;
};

type FilterResult = { filtered: string[] } | { error: string };

const filterPatchSets = (
  patchSets: string[],
  only: string | undefined,
  until: string | undefined,
): FilterResult => {
  if (only && until) {
    return { error: "Cannot use both --only and --until flags together" };
  }

  if (only) {
    if (!patchSets.includes(only)) {
      return { error: `Patch set not found: ${only}` };
    }
    return { filtered: [only] };
  }

  if (until) {
    const index = patchSets.indexOf(until);
    if (index === -1) {
      return { error: `Patch set not found: ${until}` };
    }
    return { filtered: patchSets.slice(0, index + 1) };
  }

  return { filtered: patchSets };
};

export const resolvePatchSetsToApply = (
  context: LocalContext,
  absolutePatchesDir: string,
  flags: Pick<ApplyFlags, "only" | "until">,
): string[] => {
  const allPatchSets = getSortedFolders(absolutePatchesDir);

  if (allPatchSets.length === 0) {
    return [];
  }

  const result = filterPatchSets(allPatchSets, flags.only, flags.until);

  if ("error" in result) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  return result.filtered;
};

export const applySinglePatchSet = async (params: {
  context: LocalContext;
  patchSetDir: string;
  repoDir: string;
  patchSetName: string;
  dryRun: boolean;
  verbose: boolean;
  fuzzFactor: number;
}): Promise<PatchSetStats> => {
  const {
    context,
    patchSetDir,
    repoDir,
    patchSetName,
    dryRun,
    verbose,
    fuzzFactor,
  } = params;
  const patchFiles = await collectPatchToApplys(patchSetDir, repoDir);
  const errors: Array<{ file: string; error: string }> = [];

  context.process.stdout.write(
    `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
  );

  for (const patchFile of patchFiles) {
    if (dryRun) {
      if (verbose) {
        const action = patchFile.type === "copy" ? "Copy" : "Apply diff";
        context.process.stdout.write(
          `    ${action}: ${patchFile.relativePath}\n`,
        );
      }
    } else {
      const result = await applyPatch(
        patchFile,
        verbose,
        fuzzFactor,
        context.process.stdout as NodeJS.WriteStream,
      );
      if (!result.success && result.error) {
        errors.push({ file: patchFile.relativePath, error: result.error });
      }
    }
  }

  return { name: patchSetName, fileCount: patchFiles.length, errors };
};
