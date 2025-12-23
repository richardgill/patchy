import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import {
  DEFAULT_CONFIG_PATH,
  type JsonConfig,
  jsonConfigSchema,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { parseJsonc, updateJsoncField } from "~/lib/jsonc";
import type { Prompts } from "~/lib/prompts";
import type { BaseFlags } from "./flags";

export type BaseConfig = {
  configPath: string;
  content: string;
  sourceRepo: string;
  upstreamBranch?: string;
  currentBase: string;
};

export const loadConfig = (
  context: LocalContext,
  flags: BaseFlags,
): BaseConfig => {
  const configPath = resolve(context.cwd, flags.config ?? DEFAULT_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return exit(context, {
      exitCode: 1,
      stderr: `Configuration file not found: ${configPath}`,
    });
  }

  const content = readFileSync(configPath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);

  if (!parseResult.success) {
    return exit(context, { exitCode: 1, stderr: parseResult.error });
  }

  const zodResult = jsonConfigSchema.safeParse(parseResult.json);
  if (!zodResult.success) {
    return exit(context, { exitCode: 1, stderr: "Invalid configuration file" });
  }

  const config = zodResult.data;

  return {
    configPath,
    content,
    sourceRepo: config.source_repo ?? "",
    upstreamBranch: config.upstream_branch,
    currentBase: config.base_revision ?? "",
  };
};

export const writeConfigUpdate = async (
  context: LocalContext,
  configPath: string,
  content: string,
  newBase: string,
  prompts?: Prompts,
): Promise<void> => {
  const updateResult = updateJsoncField(content, "base_revision", newBase);

  if (!updateResult.success) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(updateResult.error),
    });
  }

  try {
    await writeFile(configPath, updateResult.content, "utf8");
    if (prompts) {
      prompts.outro(chalk.green(`Updated base_revision to: ${newBase}`));
    } else {
      context.process.stdout.write(
        chalk.green(`Updated base_revision to: ${newBase}\n`),
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Failed to update config: ${errorMessage}`),
    });
  }
};
