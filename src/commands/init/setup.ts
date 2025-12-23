import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "@stricli/core";
import chalk from "chalk";
import { app } from "~/app";
import { DEFAULT_CONFIG_PATH, type JsonConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay, resolvePath } from "~/lib/fs";
import { extractRepoName } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
import { generateJsonConfig } from "./config";
import type { InitFlags } from "./flags";
import { addToGitignoreFile } from "./gitignore";

export const createDirectoriesAndFiles = async (
  context: LocalContext,
  flags: InitFlags,
  config: JsonConfig,
  addToGitignore: boolean,
): Promise<void> => {
  const prompts = createPrompts(context);
  const clonesDir = config.clones_dir ?? "";

  const absolutePatchesDir = resolvePath(context.cwd, config.patches_dir ?? "");
  if (config.patches_dir) {
    try {
      await mkdir(absolutePatchesDir, { recursive: true });
      prompts.log.step(
        `Created patches directory: ${chalk.cyan(formatPathForDisplay(config.patches_dir ?? ""))}`,
      );
    } catch (error) {
      return exit(context, {
        exitCode: 1,
        stderr: `Failed to create patches directory: ${error}`,
      });
    }
  }

  const absoluteClonesDir = resolvePath(context.cwd, clonesDir);
  if (clonesDir) {
    try {
      await mkdir(absoluteClonesDir, { recursive: true });
      prompts.log.step(
        `Created clones directory: ${chalk.cyan(formatPathForDisplay(clonesDir))}`,
      );
    } catch (error) {
      return exit(context, {
        exitCode: 1,
        stderr: `Failed to create clones directory: ${error}`,
      });
    }
  }

  if (addToGitignore && clonesDir) {
    try {
      await addToGitignoreFile(context.cwd, clonesDir);
      prompts.log.step(
        `Added ${chalk.cyan(formatPathForDisplay(clonesDir))} to ${chalk.cyan(".gitignore")}`,
      );
    } catch (error) {
      return exit(context, {
        exitCode: 1,
        stderr: `Failed to update .gitignore: ${error}`,
      });
    }
  }

  const configPath = resolve(context.cwd, flags.config ?? DEFAULT_CONFIG_PATH);
  const jsonContent = await generateJsonConfig(config);

  try {
    await writeFile(configPath, jsonContent, "utf8");
    prompts.log.step(
      `Created configuration file: ${chalk.cyan(flags.config ?? DEFAULT_CONFIG_PATH)}`,
    );
  } catch (error) {
    return exit(context, {
      exitCode: 1,
      stderr: `Failed to create configuration file: ${error}`,
    });
  }
};

export const promptAndRunClone = async (
  context: LocalContext,
  clonesDir: string,
  repoUrl: string,
): Promise<void> => {
  const repoName = extractRepoName(repoUrl) ?? "repository";

  if (!canPrompt(context)) {
    context.process.stdout.write(
      `\nRun ${chalk.cyan("patchy repo clone")} to clone ${chalk.cyan(repoName)} into ${chalk.cyan(formatPathForDisplay(clonesDir))}\n`,
    );
    return;
  }

  const prompts = createPrompts(context);
  const shouldClone = await prompts.confirm({
    message: `Clone ${chalk.cyan(repoName)} into ${chalk.cyan(formatPathForDisplay(clonesDir))} now?`,
    initialValue: true,
  });

  if (prompts.isCancel(shouldClone) || !shouldClone) {
    context.process.stdout.write(
      `\nRun ${chalk.cyan("patchy repo clone")} when you're ready to clone your repo into ${chalk.cyan(formatPathForDisplay(clonesDir))}\n`,
    );
    return;
  }

  context.process.stdout.write("\n");
  await run(app, ["repo", "clone"], context);

  context.process.stdout.write(
    `\nNow you can edit your clone ${chalk.cyan(formatPathForDisplay(join(clonesDir, repoName)))} and run ${chalk.cyan("patchy generate")} to generate patches\n`,
  );
};
