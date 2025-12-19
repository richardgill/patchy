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
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const repoDir = config.absoluteTargetRepo ?? "";
  const baseRevision = assertDefined(config.base_revision, "base_revision");
  const dryRun = config.dry_run;
  const verbose = config.verbose;

  if (!existsSync(repoDir)) {
    this.process.stderr.write(
      chalk.red(`Repository directory does not exist: ${repoDir}\n`),
    );
    this.process.exit(1);
    return;
  }

  const git = createGitClient(repoDir);
  const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isRepo) {
    this.process.stderr.write(chalk.red(`Not a Git repository: ${repoDir}\n`));
    this.process.exit(1);
    return;
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
      this.process.stderr.write("Reset cancelled\n");
      this.process.exit(1);
      return;
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
    this.process.stderr.write(
      chalk.red(
        `Failed to reset to base_revision "${baseRevision}": ${message}\n`,
      ),
    );
    this.process.exit(1);
    return;
  }
}
