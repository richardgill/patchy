import { existsSync } from "node:fs";
import * as prompts from "@clack/prompts";
import chalk from "chalk";
import { CheckRepoActions } from "simple-git";
import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { createGitClient } from "~/lib/git";
import type { ResetFlags } from "./flags";

export default async function (
  this: LocalContext,
  flags: ResetFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: ["repo_base_dir", "repo_dir"],
    cwd: this.cwd,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const repoDir = config.absoluteRepoDir ?? "";
  const dryRun = config.dry_run;

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

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would hard reset repository: ${repoDir}\n`,
    );
    return;
  }

  if (!flags.yes) {
    const confirmed = await prompts.confirm({
      message: `This will discard all uncommitted changes in ${repoDir}. Continue?`,
      initialValue: false,
    });

    if (prompts.isCancel(confirmed) || !confirmed) {
      this.process.stderr.write("Reset cancelled\n");
      this.process.exit(1);
      return;
    }
  }

  await git.reset(["--hard"]);
  this.process.stdout.write(
    chalk.green(`Successfully reset repository: ${repoDir}\n`),
  );
}
