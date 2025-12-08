import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
      return;
    }

    const config = result.mergedConfig;

    if (!config.repo_base_dir) {
      this.process.stderr.write(
        chalk.red(
          "Missing required parameter: repo_base_dir\nSet --repo-base-dir flag, PATCHY_REPO_BASE_DIR env var, or repo_base_dir in config file.\n",
        ),
      );
      this.process.exit(1);
      return;
    }

    if (!config.repo_dir) {
      this.process.stderr.write(
        chalk.red(
          "Missing required parameter: repo_dir\nSet --repo-dir flag, PATCHY_REPO_DIR env var, or repo_dir in config file.\n",
        ),
      );
      this.process.exit(1);
      return;
    }

    const repoDir = resolve(config.repo_base_dir, config.repo_dir);

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
      this.process.stderr.write(
        chalk.red(`Not a Git repository: ${repoDir}\n`),
      );
      this.process.exit(1);
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
