import { existsSync } from "node:fs";
import chalk from "chalk";
import { CheckRepoActions } from "simple-git";
import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { createGitClient } from "~/lib/git";
import type { CheckoutFlags } from "./flags";

const isWorkingTreeDirty = async (repoDir: string): Promise<boolean> => {
  const git = createGitClient(repoDir);
  const status = await git.status();
  return !status.isClean();
};

const isValidGitRef = async (
  repoDir: string,
  ref: string,
): Promise<boolean> => {
  const git = createGitClient(repoDir);
  try {
    await git.revparse(["--verify", ref]);
    return true;
  } catch {
    return false;
  }
};

export default async function (
  this: LocalContext,
  flags: CheckoutFlags,
): Promise<void> {
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
  const ref = flags.ref;
  const verbose = config.verbose;
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

  if (verbose) {
    this.process.stdout.write(`Checking out ref "${ref}" in ${upstreamDir}\n`);
  }

  if (await isWorkingTreeDirty(upstreamDir)) {
    this.process.stderr.write(
      chalk.red(`Working tree in ${upstreamDir} has uncommitted changes.\n`),
    );
    this.process.stderr.write(
      "Please commit or stash your changes before checking out a different ref.\n",
    );
    this.process.exit(1);
    return;
  }

  if (!(await isValidGitRef(upstreamDir, ref))) {
    this.process.stderr.write(chalk.red(`Invalid git ref "${ref}".\n`));
    this.process.stderr.write(
      "Please specify a valid branch, tag, or commit SHA.\n",
    );
    this.process.exit(1);
    return;
  }

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would checkout ref "${ref}" in ${upstreamDir}\n`,
    );
    return;
  }

  await git.checkout(ref);
  this.process.stdout.write(
    chalk.green(`Successfully checked out "${ref}".\n`),
  );
}
