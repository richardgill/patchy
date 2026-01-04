import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import type { JsonConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { parseJsonc, updateJsoncField } from "~/lib/jsonc";
import { canPrompt, createPrompts } from "~/lib/prompts";
import type { CloneConfig } from "./config";

type ConfigFileResult =
  | { exists: false }
  | { exists: true; content: string; path: string; json: JsonConfig };

const readConfigFile = (
  context: LocalContext,
  configPath: string,
): ConfigFileResult => {
  const absolutePath = resolve(context.cwd, configPath);
  if (!existsSync(absolutePath)) {
    return { exists: false };
  }

  const content = readFileSync(absolutePath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);
  if (!parseResult.success) {
    return { exists: false };
  }

  return { exists: true, content, path: absolutePath, json: parseResult.json };
};

const buildPromptMessage = (
  currentTargetRepo: string | undefined,
  newTargetDirName: string,
): string =>
  currentTargetRepo
    ? `target_repo in ${chalk.cyan("patchy.json")} is ${chalk.cyan(`"${currentTargetRepo}"`)}. Update to ${chalk.cyan(`"${newTargetDirName}"`)}?`
    : `Save target_repo: ${chalk.cyan(`"${newTargetDirName}"`)} to ${chalk.cyan("patchy.json")}?`;

const saveConfigUpdate = async (
  context: LocalContext,
  configPath: string,
  content: string,
  targetDirName: string,
): Promise<void> => {
  const updateResult = updateJsoncField(content, "target_repo", targetDirName);

  if (!updateResult.success) {
    context.process.stderr.write(chalk.yellow(`${updateResult.error}\n`));
    return;
  }

  try {
    await writeFile(configPath, updateResult.content, "utf8");
    context.process.stdout.write(
      chalk.green(`Updated patchy.json with target_repo: "${targetDirName}"\n`),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.process.stderr.write(
      chalk.yellow(`Failed to update patchy.json: ${errorMessage}\n`),
    );
  }
};

export const promptRepoDirSave = async (
  context: LocalContext,
  config: CloneConfig,
): Promise<void> => {
  const configFile = readConfigFile(context, config.configPath);
  if (!configFile.exists) return;
  if (configFile.json.target_repo === config.targetDirName) return;

  if (config.skipConfirmation) {
    await saveConfigUpdate(
      context,
      configFile.path,
      configFile.content,
      config.targetDirName,
    );
    return;
  }

  if (!canPrompt(context)) return;

  const message = buildPromptMessage(
    configFile.json.target_repo,
    config.targetDirName,
  );

  const prompts = createPrompts(context);
  const confirmed = await prompts.confirm({ message, initialValue: true });

  if (prompts.isCancel(confirmed) || !confirmed) return;

  await saveConfigUpdate(
    context,
    configFile.path,
    configFile.content,
    config.targetDirName,
  );
};
