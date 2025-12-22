import { existsSync } from "node:fs";
import chalk from "chalk";
import { compact } from "es-toolkit";
import { CheckRepoActions } from "simple-git";
import {
  createEnrichedMergedConfig,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";
import { exit } from "~/lib/exit";
import { createGitClient } from "~/lib/git";
import { createPrompts } from "~/lib/prompts";
import type { ResetFlags } from "./flags";

export default async function (
  this: LocalContext,
  flags: ResetFlags,
): Promise<void> {
  const prompts = createPrompts(this);
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([!hasAbsoluteTargetRepo(config) && "clones_dir", "target_repo"]),
    cwd: this.cwd,
  });

  if (!result.success) {
    return exit(this, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  const repoDir = config.absoluteTargetRepo ?? "";
  const baseRevision = assertDefined(config.base_revision, "base_revision");
  const dryRun = config.dry_run;
  const verbose = config.verbose;

  if (!existsSync(repoDir)) {
    return exit(this, {
      exitCode: 1,
      stderr: chalk.red(`Repository directory does not exist: ${repoDir}`),
    });
  }

  const git = createGitClient(repoDir);
  const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isRepo) {
    return exit(this, {
      exitCode: 1,
      stderr: chalk.red(`Not a Git repository: ${repoDir}`),
    });
  }

  if (verbose) {
    this.process.stdout.write(`Repository directory: ${repoDir}\n`);
    this.process.stdout.write(`Base revision: ${baseRevision}\n`);
  }

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would hard reset repository to ${baseRevision}: ${repoDir}\n`,
    );
    return;
  }

  if (!flags.yes) {
    const confirmed = await prompts.confirm({
      message: `This will reset ${repoDir} to ${baseRevision}, discarding all commits and uncommitted changes. Continue?`,
      initialValue: false,
    });

    if (prompts.isCancel(confirmed) || !confirmed) {
      return exit(this, { exitCode: 1, stderr: "Reset cancelled" });
    }
  }

  try {
    await git.reset(["--hard", baseRevision]);
    this.process.stdout.write(
      chalk.green(
        `Successfully reset repository to ${baseRevision}: ${repoDir}\n`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return exit(this, {
      exitCode: 1,
      stderr: chalk.red(
        `Failed to reset to base_revision "${baseRevision}": ${message}`,
      ),
    });
  }
}
