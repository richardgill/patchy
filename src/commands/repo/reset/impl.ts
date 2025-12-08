import { existsSync } from "node:fs";
import chalk from "chalk";
import simpleGit, { CheckRepoActions } from "simple-git";
import { resolveConfig } from "~/config/resolver";
import type { ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";

type ResetCommandFlags = {
  "repo-base-dir"?: string;
  "repo-dir"?: string;
  config?: string;
  verbose?: boolean;
};

export default async function (
  this: LocalContext,
  flags: ResetCommandFlags,
): Promise<void> {
  const config = (await resolveConfig(this, flags, [
    "repo_base_dir",
    "repo_dir",
  ])) as ResolvedConfig;

  const repoDir = config.absoluteRepoDir;
  assertDefined(repoDir, "repo_dir is required");

  if (!existsSync(repoDir)) {
    this.process.stderr.write(
      chalk.red(`Repository directory does not exist: ${repoDir}\n`),
    );
    this.process.exit(1);
    return;
  }

  const git = simpleGit(repoDir);
  const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isRepo) {
    this.process.stderr.write(chalk.red(`Not a Git repository: ${repoDir}\n`));
    this.process.exit(1);
    return;
  }

  try {
    await git.reset(["--hard"]);
    this.process.stdout.write(
      chalk.green(`Successfully reset repository: ${repoDir}\n`),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.process.stderr.write(
      chalk.red(`Failed to reset repository: ${message}\n`),
    );
    this.process.exit(1);
  }
}
