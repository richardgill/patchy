import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { getSortedFolders } from "~/lib/fs";
import {
  executeHook,
  findHook,
  getHookFilenames,
  type HookEnv,
  type HookInfo,
  validateHookPermissions,
} from "~/lib/hooks";
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

type RunHookParams = {
  hook: HookInfo;
  dryRun: boolean;
  verbose: boolean;
  repoDir: string;
  hookEnv: HookEnv;
  context: LocalContext;
};

const runHook = async (
  params: RunHookParams,
): Promise<{ success: true } | { success: false; error: string }> => {
  const { hook, dryRun, verbose, repoDir, hookEnv, context } = params;

  if (dryRun) {
    if (verbose) {
      context.process.stdout.write(`    Would run hook: ${hook.name}\n`);
    }
    return { success: true };
  }

  context.process.stdout.write(`    Running hook: ${hook.name}\n`);
  return executeHook({ hook, cwd: repoDir, env: hookEnv, context });
};

type ApplySinglePatchSetParams = {
  context: LocalContext;
  patchSetDir: string;
  repoDir: string;
  patchSetName: string;
  dryRun: boolean;
  verbose: boolean;
  fuzzFactor: number;
  hookPrefix: string;
  patchesDir: string;
  baseRevision?: string;
};

export const applySinglePatchSet = async (
  params: ApplySinglePatchSetParams,
): Promise<PatchSetStats> => {
  const {
    context,
    patchSetDir,
    repoDir,
    patchSetName,
    dryRun,
    verbose,
    fuzzFactor,
    hookPrefix,
    patchesDir,
    baseRevision,
  } = params;

  const hookEnv: HookEnv = {
    PATCHY_TARGET_REPO: repoDir,
    PATCHY_PATCH_SET: patchSetName,
    PATCHY_PATCHES_DIR: patchesDir,
    PATCHY_PATCH_SET_DIR: patchSetDir,
    ...(baseRevision ? { PATCHY_BASE_REVISION: baseRevision } : {}),
  };

  const preHook = findHook({
    dir: patchSetDir,
    prefix: hookPrefix,
    type: "pre-apply",
  });
  const postHook = findHook({
    dir: patchSetDir,
    prefix: hookPrefix,
    type: "post-apply",
  });

  if (preHook) {
    const validation = validateHookPermissions({
      hook: preHook,
      patchSetName,
      patchSetDir,
    });
    if (!validation.success) {
      return exit(context, { exitCode: 1, stderr: validation.error });
    }
  }
  if (postHook) {
    const validation = validateHookPermissions({
      hook: postHook,
      patchSetName,
      patchSetDir,
    });
    if (!validation.success) {
      return exit(context, { exitCode: 1, stderr: validation.error });
    }
  }

  const hookFilenames = getHookFilenames(hookPrefix);
  const patchFiles = await collectPatchToApplys({
    patchSetDir,
    repoDir,
    exclude: hookFilenames,
  });
  const errors: Array<{ file: string; error: string }> = [];

  const lineEnding = verbose ? "\n" : "";
  context.process.stdout.write(
    `  [${patchSetName}] ${patchFiles.length} file(s)${lineEnding}`,
  );

  if (preHook) {
    const result = await runHook({
      hook: preHook,
      dryRun,
      verbose,
      repoDir,
      hookEnv,
      context,
    });
    if (!result.success) {
      return exit(context, { exitCode: 1, stderr: result.error });
    }
  }

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

  if (postHook) {
    const result = await runHook({
      hook: postHook,
      dryRun,
      verbose,
      repoDir,
      hookEnv,
      context,
    });
    if (!result.success) {
      return exit(context, { exitCode: 1, stderr: result.error });
    }
  }

  return { name: patchSetName, fileCount: patchFiles.length, errors };
};
