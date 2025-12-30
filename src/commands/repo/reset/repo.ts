import { existsSync } from "node:fs";
import chalk from "chalk";
import { CheckRepoActions } from "simple-git";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { toRelativeDisplayPath } from "~/lib/fs";
import { createGitClient } from "~/lib/git";

export const ensureValidGitRepo = async (
  context: LocalContext,
  repoDir: string,
): Promise<void> => {
  const displayPath = toRelativeDisplayPath(repoDir, context.cwd);
  if (!existsSync(repoDir)) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Repository directory does not exist: ${displayPath}`),
    });
  }

  const git = createGitClient({ baseDir: repoDir });
  const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isRepo) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Not a Git repository: ${displayPath}`),
    });
  }
};
