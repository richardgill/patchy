import { existsSync } from "node:fs";
import chalk from "chalk";
import { CheckRepoActions } from "simple-git";
import { createMergedConfig } from "~/config/resolver";
import type { ResetCommandFlags } from "~/config/types";
import type { LocalContext } from "~/context";
import { createGitClient } from "~/lib/git";

export default async function (
  this: LocalContext,
  flags: ResetCommandFlags,
): Promise<void> {
  try {
    const result = createMergedConfig({
      flags,
      requiredFields: ["repo_base_dir", "repo_dir"],
    });

    if (!result.success) {
      this.process.stderr.write(result.error);
      this.process.exit(1);
    }

    const config = result.mergedConfig;
    const repoDir = config.absoluteRepoDir ?? "";
    const dryRun = config.dry_run;

    if (!existsSync(repoDir)) {
      this.process.stderr.write(
        chalk.red(`Repository directory does not exist: ${repoDir}\n`),
      );
      this.process.exit(1);
    }

    const git = createGitClient(repoDir);
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    if (!isRepo) {
      this.process.stderr.write(
        chalk.red(`Not a Git repository: ${repoDir}\n`),
      );
      this.process.exit(1);
    }

    if (dryRun) {
      this.process.stdout.write(
        `[DRY RUN] Would hard reset repository: ${repoDir}\n`,
      );
      return;
    }

    await git.reset(["--hard"]);
    this.process.stdout.write(
      chalk.green(`Successfully reset repository: ${repoDir}\n`),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    this.process.stderr.write(
      chalk.red(`Failed to reset repository: ${message}\n`),
    );
    this.process.exit(1);
  }
}
