import { writeFile } from "node:fs/promises";
import chalk from "chalk";
import type { LocalContext } from "~/context";
import { loadJsonConfig } from "~/lib/cli-config";
import { exit } from "~/lib/exit";
import { updateJsoncField } from "~/lib/jsonc";
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
  const result = loadJsonConfig(context.cwd, flags.config);

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const { config, configPath, content } = result;

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
