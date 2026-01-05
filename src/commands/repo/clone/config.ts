import { join } from "node:path";
import chalk from "chalk";
import {
  createEnrichedMergedConfig,
  DEFAULT_CONFIG_PATH,
  REQUIRE_SOURCE_REPO,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import {
  findAvailableDirName,
  formatPathForDisplay,
  resolvePath,
} from "~/lib/fs";
import { extractRepoName } from "~/lib/git";
import { isValidGitUrl } from "~/lib/validation";
import type { CloneFlags } from "./flags";

const RELATIVE_PATH_PATTERN = /^\.\.?\//;

export type CloneConfig = {
  repoUrl: string;
  resolvedRepoUrl: string;
  repoName: string;
  clonesDir: string;
  targetDir: string;
  targetDirName: string;
  baseRevision: string | undefined;
  baseRevisionFromFlag: boolean;
  dry_run: boolean;
  verbose: boolean;
  configPath: string;
  displayTargetPath: string;
  skipConfirmation: boolean;
};

const validateGitUrl = (context: LocalContext, repoUrl: string): void => {
  if (!isValidGitUrl(repoUrl)) {
    exit(context, {
      exitCode: 1,
      stderr: chalk.red(
        `Invalid Git URL: ${repoUrl}\nExample: https://github.com/user/repo, git@github.com:user/repo.git, or /path/to/local/repo`,
      ),
    });
  }
};

const validateRepoName = (context: LocalContext, repoUrl: string): string => {
  const repoName = extractRepoName(repoUrl);
  if (!repoName) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(
        `Could not extract repository name from URL: ${repoUrl}`,
      ),
    });
  }
  return repoName;
};

const resolveRepoUrl = (cwd: string, repoUrl: string): string =>
  RELATIVE_PATH_PATTERN.test(repoUrl) ? resolvePath(cwd, repoUrl) : repoUrl;

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: CloneFlags,
): CloneConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requires: [REQUIRE_SOURCE_REPO],
    cwd: context.cwd,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  const repoUrl = config.source_repo;
  const clonesDir = config.absoluteClonesDir;

  validateGitUrl(context, repoUrl);
  const repoName = validateRepoName(context, repoUrl);

  const targetDirName = findAvailableDirName(clonesDir, repoName);

  return {
    repoUrl,
    resolvedRepoUrl: resolveRepoUrl(context.cwd, repoUrl),
    repoName,
    clonesDir,
    targetDir: join(clonesDir, targetDirName),
    targetDirName,
    baseRevision: config.base_revision,
    baseRevisionFromFlag: flags["base-revision"] !== undefined,
    dry_run: config.dry_run,
    verbose: config.verbose,
    configPath: config.config ?? DEFAULT_CONFIG_PATH,
    displayTargetPath: formatPathForDisplay(
      join(config.clones_dir, targetDirName),
    ),
    skipConfirmation: flags.yes ?? false,
  };
};

export const logVerboseInfo = (
  context: LocalContext,
  config: CloneConfig,
): void => {
  context.process.stdout.write(`Repository URL: ${config.repoUrl}\n`);
  context.process.stdout.write(`Clones directory: ${config.clonesDir}\n`);
  context.process.stdout.write(`Target directory: ${config.targetDir}\n`);
  context.process.stdout.write(`Base revision: ${config.baseRevision}\n`);
};

export const reportDryRun = (
  context: LocalContext,
  config: CloneConfig,
): void => {
  context.process.stdout.write(
    `[DRY RUN] Would clone ${config.repoUrl} to ${config.displayTargetPath}\n`,
  );
  if (config.baseRevision) {
    context.process.stdout.write(
      `[DRY RUN] Would checkout base_revision: ${config.baseRevision}\n`,
    );
  }
};
