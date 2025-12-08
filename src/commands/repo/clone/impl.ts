import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { createMergedConfig } from "~/config/resolver";
import type { CloneCommandFlags } from "~/config/types";
import { isValidGitUrl } from "~/config/validation";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";
import { ensureDirExists } from "~/lib/fs";
import { createGitClient, extractRepoName } from "~/lib/git";

export default async function (
  this: LocalContext,
  flags: CloneCommandFlags,
): Promise<void> {
  try {
    const result = createMergedConfig({
      flags,
      requiredFields: ["repo_url"],
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
          "Missing required parameter: repo_base_dir\nSet --repo-base-dir flag, PATCHY_REPO_BASE_DIR env var, or repo_base_dir in config file.\n",
        ),
      );
      this.process.exit(1);
      return;
    }

    const repoBaseDir = resolve(config.repo_base_dir);

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

    const targetDir = resolve(join(repoBaseDir, repoName));

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
    await git.clone(repoUrl, repoName);

    if (ref) {
      this.process.stdout.write(`Checking out ${ref}...\n`);
      const repoGit = createGitClient(targetDir);
      await repoGit.checkout(ref);
    }

    this.process.stdout.write(
      chalk.green(`Successfully cloned repository to ${targetDir}\n`),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    this.process.stderr.write(chalk.red(`Error: ${error}\n`));
    this.process.exit(1);
  }
}
