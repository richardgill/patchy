import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { createEnrichedMergedConfig, FLAG_METADATA } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";
import { ensureDirExists } from "~/lib/fs";
import { createGitClient, extractRepoName } from "~/lib/git";
import { isValidGitUrl } from "~/lib/validation";
import type { CloneFlags } from "./flags";

export default async function (
  this: LocalContext,
  flags: CloneFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: ["repo_url"],
    cwd: this.cwd,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const repoUrl = assertDefined(config.repo_url, "repo_url");
  const ref = config.ref;
  const dryRun = config.dry_run;
  const verbose = config.verbose;

  if (!config.repo_base_dir) {
    this.process.stderr.write(
      chalk.red(
        `Missing required parameter: repo_base_dir\nSet --repo-base-dir flag, ${FLAG_METADATA.repo_base_dir.env} env var, or repo_base_dir in config file.\n`,
      ),
    );
    this.process.exit(1);
    return;
  }

  const repoBaseDir = resolve(this.cwd, config.repo_base_dir);

  if (!isValidGitUrl(repoUrl)) {
    this.process.stderr.write(
      chalk.red(
        `Invalid Git URL: ${repoUrl}\nExample: https://github.com/user/repo or git@github.com:user/repo.git\n`,
      ),
    );
    this.process.exit(1);
    return;
  }

  const repoName = extractRepoName(repoUrl);
  if (!repoName) {
    this.process.stderr.write(
      chalk.red(`Could not extract repository name from URL: ${repoUrl}\n`),
    );
    this.process.exit(1);
    return;
  }

  const targetDir = join(repoBaseDir, repoName);

  if (verbose) {
    this.process.stdout.write(`Repository URL: ${repoUrl}\n`);
    this.process.stdout.write(`Repository base directory: ${repoBaseDir}\n`);
    this.process.stdout.write(`Target directory: ${targetDir}\n`);
    this.process.stdout.write(`Git ref: ${ref}\n`);
  }

  if (existsSync(targetDir)) {
    this.process.stderr.write(
      chalk.red(`Target directory already exists: ${targetDir}\n`),
    );
    this.process.exit(1);
    return;
  }

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would clone ${repoUrl} to ${targetDir}\n`,
    );
    if (ref) {
      this.process.stdout.write(`[DRY RUN] Would checkout ref: ${ref}\n`);
    }
    return;
  }

  ensureDirExists(repoBaseDir);

  this.process.stdout.write(`Cloning ${repoUrl} to ${targetDir}...\n`);

  const git = createGitClient(repoBaseDir);
  try {
    await git.clone(repoUrl, repoName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.process.stderr.write(
      chalk.red(`Failed to clone repository: ${message}\n`),
    );
    this.process.exit(1);
    return;
  }

  if (ref) {
    this.process.stdout.write(`Checking out ${ref}...\n`);
    const repoGit = createGitClient(targetDir);
    try {
      await repoGit.checkout(ref);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.process.stderr.write(
        chalk.red(`Failed to checkout ref "${ref}": ${message}\n`),
      );
      this.process.exit(1);
      return;
    }
  }

  this.process.stdout.write(
    chalk.green(`Successfully cloned repository to ${targetDir}\n`),
  );
}
