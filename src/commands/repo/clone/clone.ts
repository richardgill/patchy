import chalk from "chalk";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { ensureDirExists } from "~/lib/fs";
import { createGitClient } from "~/lib/git";
import type { CloneConfig } from "./config";

const cloneRepository = async (
  context: LocalContext,
  config: CloneConfig,
): Promise<void> => {
  const git = createGitClient(config.clonesDir);
  try {
    await git.clone(config.resolvedRepoUrl, config.targetDirName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Failed to clone repository: ${message}`),
    });
  }
};

const checkoutRevision = async (
  context: LocalContext,
  config: CloneConfig,
): Promise<void> => {
  if (!config.baseRevision) return;

  context.process.stdout.write(`Checking out ${config.baseRevision}...\n`);
  const repoGit = createGitClient(config.targetDir);
  try {
    await repoGit.checkout(config.baseRevision);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    exit(context, {
      exitCode: 1,
      stderr: chalk.red(
        `Failed to checkout base_revision "${config.baseRevision}": ${message}`,
      ),
    });
  }
};

export const performClone = async (
  context: LocalContext,
  config: CloneConfig,
): Promise<void> => {
  ensureDirExists(config.clonesDir);
  context.process.stdout.write(
    `Cloning ${config.repoUrl} to ${config.displayTargetPath}...\n`,
  );

  await cloneRepository(context, config);
  await checkoutRevision(context, config);

  context.process.stdout.write(
    chalk.green(
      `Successfully cloned repository to ${config.displayTargetPath}\n`,
    ),
  );
};
