import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compact, sumBy } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  DEFAULT_FUZZ_FACTOR,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay, getAllFiles, getSortedFolders } from "~/lib/fs";
import { createGitClient, isGitRepo } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
import { applyDiff } from "./apply-diff";
import type { ApplyFlags } from "./flags";

type PatchToApply = {
  relativePath: string;
  absolutePath: string;
  type: "copy" | "diff";
  targetPath: string;
};

type PatchSetStats = {
  name: string;
  fileCount: number;
  errors: Array<{ file: string; error: string }>;
};

const collectPatchToApplys = async (
  patchSetDir: string,
  repoDir: string,
): Promise<PatchToApply[]> => {
  if (!existsSync(patchSetDir)) {
    return [];
  }
  const relativePaths = await getAllFiles(patchSetDir);

  return relativePaths.map((relativePath) => {
    const absolutePath = path.join(patchSetDir, relativePath);
    const isDiff = relativePath.endsWith(".diff");
    const targetRelativePath = isDiff
      ? relativePath.slice(0, -5)
      : relativePath;
    const targetPath = path.join(repoDir, targetRelativePath);

    return {
      relativePath,
      absolutePath,
      type: isDiff ? "diff" : "copy",
      targetPath,
    };
  });
};

const applyPatch = async (
  patchFile: PatchToApply,
  verbose: boolean,
  fuzzFactor: number,
  stdout: NodeJS.WriteStream,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (patchFile.type === "copy") {
      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await copyFile(patchFile.absolutePath, patchFile.targetPath);
      if (verbose) {
        stdout.write(`    Copied: ${patchFile.relativePath}\n`);
      }
    } else {
      if (!existsSync(patchFile.targetPath)) {
        return {
          success: false,
          error: `Target file does not exist: ${patchFile.targetPath}`,
        };
      }

      const diffContent = await readFile(patchFile.absolutePath, "utf-8");
      const originalContent = await readFile(patchFile.targetPath, "utf-8");
      const patchedContent = applyDiff(
        originalContent,
        diffContent,
        fuzzFactor,
      );

      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await writeFile(patchFile.targetPath, patchedContent);

      if (verbose) {
        stdout.write(`    Applied diff: ${patchFile.relativePath}\n`);
      }
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

const validateCommitFlags = (
  all: boolean | undefined,
  edit: boolean | undefined,
): { error?: string } => {
  if (all && edit) {
    return { error: "Cannot use both --all and --edit flags together" };
  }
  return {};
};

const checkWorkingTreeClean = async (
  repoDir: string,
): Promise<{ clean: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { clean: true };
  }

  try {
    const git = createGitClient(repoDir);
    const status = await git.status();

    if (status.files.length > 0) {
      return {
        clean: false,
        error:
          "Working tree is dirty. Please commit or stash changes before applying patches.",
      };
    }

    return { clean: true };
  } catch (error) {
    return {
      clean: false,
      error: `Failed to check working tree status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const commitPatchSet = async (
  repoDir: string,
  patchSetName: string,
  stdout: NodeJS.WriteStream,
): Promise<{ success: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { success: true };
  }

  try {
    const git = createGitClient(repoDir);
    await git.add(".");
    await git.commit(`Apply patch set: ${patchSetName}`);
    stdout.write(`  Committed patch set: ${patchSetName}\n`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

type CommitMode = "auto" | "prompt" | "skip";

const determineCommitMode = (
  context: LocalContext,
  flags: ApplyFlags,
  isLastPatchSet: boolean,
): CommitMode => {
  if (flags.all) {
    return "auto";
  }

  if (flags.edit) {
    return isLastPatchSet ? "skip" : "auto";
  }

  if (isLastPatchSet) {
    return canPrompt(context) ? "prompt" : "auto";
  }

  return "auto";
};

const resolvePatchSetsToApply = (
  context: LocalContext,
  absolutePatchesDir: string,
  flags: Pick<ApplyFlags, "only" | "until">,
): string[] => {
  const allPatchSets = getSortedFolders(absolutePatchesDir);

  if (allPatchSets.length === 0) {
    context.process.stdout.write("No patch sets found.\n");
    return [];
  }

  const result = filterPatchSets(allPatchSets, flags.only, flags.until);

  if ("error" in result) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  return result.filtered;
};

const ensureCleanWorkingTree = async (
  context: LocalContext,
  repoDir: string,
): Promise<void> => {
  const result = await checkWorkingTreeClean(repoDir);
  if (!result.clean && result.error) {
    exit(context, { exitCode: 1, stderr: result.error });
  }
};

const applySinglePatchSet = async (
  context: LocalContext,
  patchSetDir: string,
  repoDir: string,
  patchSetName: string,
  config: { verbose: boolean; fuzzFactor: number },
): Promise<PatchSetStats> => {
  const patchFiles = await collectPatchToApplys(patchSetDir, repoDir);
  const errors: Array<{ file: string; error: string }> = [];

  context.process.stdout.write(
    `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
  );

  for (const patchFile of patchFiles) {
    const result = await applyPatch(
      patchFile,
      config.verbose,
      config.fuzzFactor,
      context.process.stdout as NodeJS.WriteStream,
    );
    if (!result.success && result.error) {
      errors.push({ file: patchFile.relativePath, error: result.error });
    }
  }

  return { name: patchSetName, fileCount: patchFiles.length, errors };
};

const commitPatchSetIfNeeded = async (
  context: LocalContext,
  repoDir: string,
  patchSetName: string,
  flags: ApplyFlags,
  isLastPatchSet: boolean,
  hasErrors: boolean,
): Promise<{ committed: boolean; cancelled?: boolean }> => {
  if (hasErrors) {
    return { committed: false };
  }

  const mode = determineCommitMode(context, flags, isLastPatchSet);

  if (mode === "skip") {
    context.process.stdout.write(
      `  Left patch set uncommitted: ${patchSetName}\n`,
    );
    return { committed: false };
  }

  if (mode === "auto") {
    const result = await commitPatchSet(
      repoDir,
      patchSetName,
      context.process.stdout as NodeJS.WriteStream,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  const prompts = createPrompts(context);
  const shouldCommit = await prompts.confirm({
    message: `Commit changes from patch set "${patchSetName}"?`,
    initialValue: true,
  });

  if (prompts.isCancel(shouldCommit)) {
    context.process.stderr.write("Apply cancelled\n");
    return { committed: false, cancelled: true };
  }

  if (shouldCommit) {
    const result = await commitPatchSet(
      repoDir,
      patchSetName,
      context.process.stdout as NodeJS.WriteStream,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  context.process.stdout.write(
    `  Left patch set uncommitted: ${patchSetName}\n`,
  );
  return { committed: false };
};

const printDryRunPatchSet = async (
  context: LocalContext,
  patchSetDir: string,
  repoDir: string,
  patchSetName: string,
  verbose: boolean,
): Promise<PatchSetStats> => {
  const patchFiles = await collectPatchToApplys(patchSetDir, repoDir);

  context.process.stdout.write(
    `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
  );

  if (verbose) {
    for (const patchFile of patchFiles) {
      const action = patchFile.type === "copy" ? "Copy" : "Apply diff";
      context.process.stdout.write(
        `    ${action}: ${patchFile.relativePath}\n`,
      );
    }
  }

  return { name: patchSetName, fileCount: patchFiles.length, errors: [] };
};

const reportResults = (context: LocalContext, stats: PatchSetStats[]): void => {
  const totalFiles = sumBy(stats, (s) => s.fileCount);
  const allErrors = stats.flatMap((s) => s.errors);

  if (allErrors.length > 0) {
    context.process.stderr.write(`\nErrors occurred while applying patches:\n`);
    for (const { file, error } of allErrors) {
      context.process.stderr.write(`  ${file}: ${error}\n`);
    }
    exit(context, { exitCode: 1 });
  }

  context.process.stdout.write(
    `Successfully applied ${totalFiles} patch file(s) across ${stats.length} patch set(s).\n`,
  );
};

type ApplyConfig = {
  absolutePatchesDir: string;
  absoluteTargetRepo: string;
  patches_dir: string;
  target_repo: string;
  dry_run: boolean;
  verbose: boolean;
  fuzzFactor: number;
};

const loadAndValidateConfig = (
  context: LocalContext,
  flags: ApplyFlags,
): ApplyConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([
        !hasAbsoluteTargetRepo(config) && "clones_dir",
        "target_repo",
        "patches_dir",
      ]),
    cwd: context.cwd,
    env: context.process.env,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const flagValidation = validateCommitFlags(flags.all, flags.edit);
  if (flagValidation.error !== undefined) {
    return exit(context, { exitCode: 1, stderr: flagValidation.error });
  }

  const config = result.mergedConfig;
  return {
    absolutePatchesDir: config.absolutePatchesDir ?? "",
    absoluteTargetRepo: config.absoluteTargetRepo ?? "",
    patches_dir: config.patches_dir ?? "",
    target_repo: config.target_repo ?? "",
    dry_run: config.dry_run,
    verbose: config.verbose,
    fuzzFactor: flags["fuzz-factor"] ?? DEFAULT_FUZZ_FACTOR,
  };
};

export default async function (
  this: LocalContext,
  flags: ApplyFlags,
): Promise<void> {
  const config = loadAndValidateConfig(this, flags);

  const patchSets = resolvePatchSetsToApply(
    this,
    config.absolutePatchesDir,
    flags,
  );
  if (patchSets.length === 0) return;

  if (config.dry_run) {
    this.process.stdout.write(
      `[DRY RUN] Would apply patches from ${formatPathForDisplay(config.patches_dir)} to ${formatPathForDisplay(config.target_repo)}\n`,
    );
  } else {
    await ensureCleanWorkingTree(this, config.absoluteTargetRepo);
  }

  this.process.stdout.write("Applying patch sets...\n");

  const stats: PatchSetStats[] = [];

  for (let i = 0; i < patchSets.length; i++) {
    const patchSetName = patchSets[i];
    const isLast = i === patchSets.length - 1;
    const patchSetDir = path.join(config.absolutePatchesDir, patchSetName);

    const result = config.dry_run
      ? await printDryRunPatchSet(
          this,
          patchSetDir,
          config.absoluteTargetRepo,
          patchSetName,
          config.verbose,
        )
      : await applySinglePatchSet(
          this,
          patchSetDir,
          config.absoluteTargetRepo,
          patchSetName,
          config,
        );

    if (!config.dry_run) {
      const commitResult = await commitPatchSetIfNeeded(
        this,
        config.absoluteTargetRepo,
        patchSetName,
        flags,
        isLast,
        result.errors.length > 0,
      );
      if (commitResult.cancelled) {
        exit(this, { exitCode: 1 });
      }
    }

    stats.push(result);
  }

  reportResults(this, stats);
}
