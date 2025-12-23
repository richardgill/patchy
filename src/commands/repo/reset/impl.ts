import chalk from "chalk";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { createGitClient } from "~/lib/git";
import { createPrompts } from "~/lib/prompts";
import { loadAndValidateConfig } from "./config";
import type { ResetFlags } from "./flags";
import { ensureValidGitRepo } from "./repo";

export default async function (
  this: LocalContext,
  flags: ResetFlags,
): Promise<void> {
  const config = loadAndValidateConfig(this, flags);
  await ensureValidGitRepo(this, config.repoDir);

  if (config.verbose) {
    this.process.stdout.write(`Repository directory: ${config.repoDir}\n`);
    this.process.stdout.write(`Base revision: ${config.baseRevision}\n`);
  }

  if (config.dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would hard reset repository to ${config.baseRevision}: ${config.repoDir}\n`,
    );
    return;
  }

  if (!config.skipConfirmation) {
    const prompts = createPrompts(this);
    const confirmed = await prompts.confirm({
      message: `This will reset ${config.repoDir} to ${config.baseRevision}, discarding all commits and uncommitted changes. Continue?`,
      initialValue: false,
    });

    if (prompts.isCancel(confirmed) || !confirmed) {
      return exit(this, { exitCode: 1, stderr: "Reset cancelled" });
    }
  }

  try {
    const git = createGitClient({ baseDir: config.repoDir });
    await git.reset(["--hard", config.baseRevision]);
    this.process.stdout.write(
      chalk.green(
        `Successfully reset repository to ${config.baseRevision}: ${config.repoDir}\n`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return exit(this, {
      exitCode: 1,
      stderr: chalk.red(
        `Failed to reset to base_revision "${config.baseRevision}": ${message}`,
      ),
    });
  }
}
