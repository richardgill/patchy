import { existsSync } from "node:fs";
import chalk from "chalk";
import { CheckRepoActions } from "simple-git";
import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
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
    requiredFields: ["clones_dir", "upstream_dir"],
    cwd: this.cwd,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const upstreamDir = config.absoluteUpstreamDir ?? "";
  const dryRun = config.dry_run;

  if (!existsSync(upstreamDir)) {
    this.process.stderr.write(
      chalk.red(`Upstream directory does not exist: ${upstreamDir}\n`),
    );
    this.process.exit(1);
    return;
  }

  const git = createGitClient(upstreamDir);
  const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isRepo) {
    this.process.stderr.write(
      chalk.red(`Not a Git repository: ${upstreamDir}\n`),
    );
    this.process.exit(1);
    return;
  }

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would hard reset repository: ${upstreamDir}\n`,
    );
    return;
  }

  if (!flags.yes) {
    const confirmed = await prompts.confirm({
      message: `This will discard all uncommitted changes in ${upstreamDir}. Continue?`,
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
    chalk.green(`Successfully reset repository: ${upstreamDir}\n`),
  );
}
