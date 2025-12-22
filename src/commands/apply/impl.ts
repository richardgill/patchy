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

type FilterResult =
  | { filtered: string[]; error?: undefined }
  | { filtered?: undefined; error: string };

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

export default async function (
  this: LocalContext,
  flags: ApplyFlags,
): Promise<void> {
  try {
    const result = createEnrichedMergedConfig({
      flags,
      requiredFields: (config) =>
        compact([
          !hasAbsoluteTargetRepo(config) && "clones_dir",
          "target_repo",
          "patches_dir",
        ]),
      cwd: this.cwd,
      env: this.process.env,
    });

    if (!result.success) {
      return exit(this, { exitCode: 1, stderr: result.error });
    }

    const config = result.mergedConfig;
    const absolutePatchesDir = config.absolutePatchesDir ?? "";
    const absoluteTargetRepo = config.absoluteTargetRepo ?? "";

    const flagValidation = validateCommitFlags(flags.all, flags.edit);
    if (flagValidation.error !== undefined) {
      return exit(this, { exitCode: 1, stderr: flagValidation.error });
    }

    const allPatchSets = getSortedFolders(absolutePatchesDir);

    if (allPatchSets.length === 0) {
      this.process.stdout.write("No patch sets found.\n");
      return;
    }

    const filterResult = filterPatchSets(allPatchSets, flags.only, flags.until);

    if (filterResult.error !== undefined) {
      return exit(this, { exitCode: 1, stderr: filterResult.error });
    }

    const patchSetsToApply = filterResult.filtered;

    if (config.dry_run) {
      this.process.stdout.write(
        `[DRY RUN] Would apply patches from ${formatPathForDisplay(config.patches_dir ?? "")} to ${formatPathForDisplay(config.target_repo ?? "")}\n`,
      );
    }

    if (!config.dry_run) {
      const treeCheck = await checkWorkingTreeClean(absoluteTargetRepo);
      if (!treeCheck.clean && treeCheck.error) {
        return exit(this, { exitCode: 1, stderr: treeCheck.error });
      }
    }

    const fuzzFactor = flags["fuzz-factor"] ?? DEFAULT_FUZZ_FACTOR;
    const stats: PatchSetStats[] = [];

    this.process.stdout.write("Applying patch sets...\n");

    for (let i = 0; i < patchSetsToApply.length; i++) {
      const patchSetName = patchSetsToApply[i];
      const isLastPatchSet = i === patchSetsToApply.length - 1;
      const patchSetDir = path.join(absolutePatchesDir, patchSetName);
      const patchFiles = await collectPatchToApplys(
        patchSetDir,
        absoluteTargetRepo,
      );

      const patchSetStats: PatchSetStats = {
        name: patchSetName,
        fileCount: patchFiles.length,
        errors: [],
      };

      if (config.dry_run) {
        this.process.stdout.write(
          `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
        );
        if (config.verbose) {
          for (const patchFile of patchFiles) {
            const action = patchFile.type === "copy" ? "Copy" : "Apply diff";
            this.process.stdout.write(
              `    ${action}: ${patchFile.relativePath}\n`,
            );
          }
        }
        stats.push(patchSetStats);
        continue;
      }

      this.process.stdout.write(
        `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
      );

      for (const patchFile of patchFiles) {
        const patchResult = await applyPatch(
          patchFile,
          config.verbose,
          fuzzFactor,
          this.process.stdout as NodeJS.WriteStream,
        );
        if (!patchResult.success && patchResult.error) {
          patchSetStats.errors.push({
            file: patchFile.relativePath,
            error: patchResult.error,
          });
        }
      }

      stats.push(patchSetStats);

      if (patchSetStats.errors.length === 0) {
        const commitMode = determineCommitMode(this, flags, isLastPatchSet);

        if (commitMode === "auto") {
          const commitResult = await commitPatchSet(
            absoluteTargetRepo,
            patchSetName,
            this.process.stdout as NodeJS.WriteStream,
          );
          if (!commitResult.success) {
            return exit(this, {
              exitCode: 1,
              stderr: `Error: Could not commit patch set: ${commitResult.error}`,
            });
          }
        } else if (commitMode === "prompt") {
          const prompts = createPrompts(this);
          const shouldCommit = await prompts.confirm({
            message: `Commit changes from patch set "${patchSetName}"?`,
            initialValue: true,
          });

          if (prompts.isCancel(shouldCommit)) {
            return exit(this, { exitCode: 1, stderr: "Apply cancelled" });
          }

          if (shouldCommit) {
            const commitResult = await commitPatchSet(
              absoluteTargetRepo,
              patchSetName,
              this.process.stdout as NodeJS.WriteStream,
            );
            if (!commitResult.success) {
              return exit(this, {
                exitCode: 1,
                stderr: `Error: Could not commit patch set: ${commitResult.error}`,
              });
            }
          } else {
            this.process.stdout.write(
              `  Left patch set uncommitted: ${patchSetName}\n`,
            );
          }
        } else {
          this.process.stdout.write(
            `  Left patch set uncommitted: ${patchSetName}\n`,
          );
        }
      }
    }

    const totalFiles = sumBy(stats, (s) => s.fileCount);
    const allErrors = stats.flatMap((s) => s.errors);

    if (allErrors.length > 0) {
      const errorLines = allErrors.map(
        ({ file, error }) => `  ${file}: ${error}`,
      );
      return exit(this, {
        exitCode: 1,
        stderr: `\nErrors occurred while applying patches:\n${errorLines.join("\n")}`,
      });
    }

    this.process.stdout.write(
      `Successfully applied ${totalFiles} patch file(s) across ${stats.length} patch set(s).\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    return exit(this, { exitCode: 1, stderr: `Error: ${error}` });
  }
}
