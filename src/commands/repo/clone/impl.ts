import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import {
  createEnrichedMergedConfig,
  DEFAULT_CONFIG_PATH,
  FLAG_METADATA,
  type JsonConfig,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";
import {
  ensureDirExists,
  findAvailableDirName,
  formatPathForDisplay,
  resolvePath,
} from "~/lib/fs";
import { createGitClient, extractRepoName } from "~/lib/git";
import { parseJsonc, updateJsoncField } from "~/lib/jsonc";
import { createPrompts } from "~/lib/prompts";
import { isValidGitUrl } from "~/lib/validation";
import type { CloneFlags } from "./flags";

type PromptRepoDirSaveParams = {
  repoName: string;
  configPath: string;
  context: LocalContext;
};

const promptRepoDirSave = async ({
  repoName,
  configPath,
  context,
}: PromptRepoDirSaveParams): Promise<void> => {
  const inputStream = context.promptInput;
  const isTTY = inputStream && "isTTY" in inputStream && inputStream.isTTY;
  const hasPromptHandler = context.promptHandler !== undefined;
  if (!isTTY && !hasPromptHandler) {
    return;
  }

  const absoluteConfigPath = resolve(context.cwd, configPath);

  if (!existsSync(absoluteConfigPath)) {
    return;
  }

  const content = readFileSync(absoluteConfigPath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);

  if (!parseResult.success) {
    return;
  }

  const currentTargetRepo = parseResult.json.target_repo;

  if (currentTargetRepo === repoName) {
    return;
  }

  const message = currentTargetRepo
    ? `target_repo in ${chalk.cyan("patchy.json")} is ${chalk.cyan(`"${currentTargetRepo}"`)}. Update to ${chalk.cyan(`"${repoName}"`)}?`
    : `Save target_repo: ${chalk.cyan(`"${repoName}"`)} to ${chalk.cyan("patchy.json")}?`;

  const prompts = createPrompts(context);
  const confirmed = await prompts.confirm({
    message,
    initialValue: true,
  });

  if (prompts.isCancel(confirmed) || !confirmed) {
    return;
  }

  const updateResult = updateJsoncField(content, "target_repo", repoName);

  if (!updateResult.success) {
    context.process.stderr.write(chalk.yellow(`${updateResult.error}\n`));
    return;
  }

  try {
    await writeFile(absoluteConfigPath, updateResult.content, "utf8");
    context.process.stdout.write(
      chalk.green(`Updated patchy.json with target_repo: "${repoName}"\n`),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.process.stderr.write(
      chalk.yellow(`Failed to update patchy.json: ${errorMessage}\n`),
    );
  }
};

export default async function (
  this: LocalContext,
  flags: CloneFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: ["source_repo"],
    cwd: this.cwd,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const repoUrl = assertDefined(config.source_repo, "source_repo");
  const ref = config.ref;
  const dryRun = config.dry_run;
  const verbose = config.verbose;

  if (!config.clones_dir) {
    this.process.stderr.write(
      chalk.red(
        `Missing required parameter: clones_dir\nSet --clones-dir flag, ${FLAG_METADATA.clones_dir.env} env var, or clones_dir in config file.\n`,
      ),
    );
    this.process.exit(1);
    return;
  }

  const clonesDir = resolvePath(this.cwd, config.clones_dir);

  if (!isValidGitUrl(repoUrl)) {
    this.process.stderr.write(
      chalk.red(
        `Invalid Git URL: ${repoUrl}\nExample: https://github.com/user/repo, git@github.com:user/repo.git, or /path/to/local/repo\n`,
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

  const targetDirName = findAvailableDirName(clonesDir, repoName);
  const targetDir = join(clonesDir, targetDirName);

  if (verbose) {
    this.process.stdout.write(`Repository URL: ${repoUrl}\n`);
    this.process.stdout.write(`Clones directory: ${clonesDir}\n`);
    this.process.stdout.write(`Target directory: ${targetDir}\n`);
    this.process.stdout.write(`Git ref: ${ref}\n`);
  }

  if (dryRun) {
    this.process.stdout.write(
      `[DRY RUN] Would clone ${repoUrl} to ${formatPathForDisplay(join(config.clones_dir ?? "", targetDirName))}\n`,
    );
    if (ref) {
      this.process.stdout.write(`[DRY RUN] Would checkout ref: ${ref}\n`);
    }
    return;
  }

  ensureDirExists(clonesDir);

  this.process.stdout.write(
    `Cloning ${repoUrl} to ${formatPathForDisplay(join(config.clones_dir ?? "", targetDirName))}...\n`,
  );

  const git = createGitClient(clonesDir);
  try {
    await git.clone(repoUrl, targetDirName);
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
    chalk.green(
      `Successfully cloned repository to ${formatPathForDisplay(join(config.clones_dir ?? "", targetDirName))}\n`,
    ),
  );

  await promptRepoDirSave({
    repoName: targetDirName,
    configPath: config.config ?? DEFAULT_CONFIG_PATH,
    context: this,
  });
}
