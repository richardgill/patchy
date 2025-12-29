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
  repoDir: string;
  hookEnv: HookEnv;
  context: LocalContext;
  isLast: boolean;
};

const runHook = async (
  params: RunHookParams,
): Promise<{ success: true } | { success: false; error: string }> => {
  const { hook, dryRun, repoDir, hookEnv, context, isLast } = params;
  const prefix = isLast ? "  \u2514 " : "  \u251C ";

  if (dryRun) {
    context.process.stdout.write(`${prefix}${hook.name} (skip)\n`);
    return { success: true };
  }

  return executeHook({ hook, cwd: repoDir, env: hookEnv, context, prefix });
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

  // Print patch set header
  context.process.stdout.write(`\u25CF ${patchSetName}\n`);

  // Run pre-apply hook
  if (preHook) {
    const result = await runHook({
      hook: preHook,
      dryRun,
      repoDir,
      hookEnv,
      context,
      isLast: false,
    });
    if (!result.success) {
      return exit(context, { exitCode: 1, stderr: result.error });
    }
  }

  // Apply patches
  if (verbose) {
    for (const patchFile of patchFiles) {
      const suffix = patchFile.type === "copy" ? " (new)" : "";
      context.process.stdout.write(
        `  \u251C ${patchFile.relativePath}${suffix}\n`,
      );
    }
  }

  for (const patchFile of patchFiles) {
    if (!dryRun) {
      const result = await applyPatch(
        patchFile,
        false, // Don't print individual file output in applyPatch
        fuzzFactor,
        context.process.stdout as NodeJS.WriteStream,
      );
      if (!result.success && result.error) {
        errors.push({ file: patchFile.relativePath, error: result.error });
      }
    }
  }

  // Print apply result (always ├ since commit line follows)
  const fileWord = patchFiles.length === 1 ? "file" : "files";
  if (errors.length > 0) {
    context.process.stdout.write(
      `  \u251C applied ${patchFiles.length} ${fileWord} \u2716\n`,
    );
  } else {
    context.process.stdout.write(
      `  \u251C applied ${patchFiles.length} ${fileWord} \u2714\n`,
    );
  }

  // Run post-apply hook (always ├ since commit line follows)
  if (postHook) {
    const result = await runHook({
      hook: postHook,
      dryRun,
      repoDir,
      hookEnv,
      context,
      isLast: false,
    });
    if (!result.success) {
      return exit(context, { exitCode: 1, stderr: result.error });
    }
  }

  return { name: patchSetName, fileCount: patchFiles.length, errors };
};
