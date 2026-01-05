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

const saveConfigUpdates = async (
  context: LocalContext,
  configPath: string,
  content: string,
  updates: Array<{ field: string; value: string }>,
): Promise<void> => {
  let updatedContent = content;

  for (const { field, value } of updates) {
    const result = updateJsoncField(updatedContent, field, value);
    if (!result.success) {
      context.process.stderr.write(chalk.yellow(`${result.error}\n`));
      return;
    }
    updatedContent = result.content;
  }

  try {
    await writeFile(configPath, updatedContent, "utf8");
    const fieldList = updates.map((u) => u.field).join(", ");
    context.process.stdout.write(
      chalk.green(`Updated patchy.json: ${fieldList}\n`),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.process.stderr.write(
      chalk.yellow(`Failed to update patchy.json: ${errorMessage}\n`),
    );
  }
};

export const promptConfigSave = async (
  context: LocalContext,
  config: CloneConfig,
): Promise<void> => {
  const configFile = readConfigFile(context, config.configPath);
  if (!configFile.exists) return;

  const updates: Array<{ field: string; value: string }> = [];

  if (configFile.json.target_repo !== config.targetDirName) {
    updates.push({ field: "target_repo", value: config.targetDirName });
  }
  if (
    config.baseRevisionFromFlag &&
    config.baseRevision &&
    configFile.json.base_revision !== config.baseRevision
  ) {
    updates.push({ field: "base_revision", value: config.baseRevision });
  }

  if (updates.length === 0) return;

  if (config.skipConfirmation) {
    await saveConfigUpdates(
      context,
      configFile.path,
      configFile.content,
      updates,
    );
    return;
  }

  if (!canPrompt(context)) return;

  const fieldList = updates
    .map((u) => `${u.field}: ${chalk.cyan(`"${u.value}"`)}`)
    .join(", ");
  const message = `Save ${fieldList} to ${chalk.cyan("patchy.json")}?`;

  const prompts = createPrompts(context);
  const confirmed = await prompts.confirm({ message, initialValue: true });

  if (prompts.isCancel(confirmed) || !confirmed) return;

  await saveConfigUpdates(
    context,
    configFile.path,
    configFile.content,
    updates,
  );
};
