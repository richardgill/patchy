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
import {
  buildBaseRevisionOptions,
  fetchRemoteRefs,
  getBranches,
  getLatestTags,
  MANUAL_SHA_OPTION,
} from "~/lib/git-remote";
import { parseJsonc, updateJsoncField } from "~/lib/jsonc";
import { canPrompt, createPrompts, promptForManualSha } from "~/lib/prompts";
import type { BaseFlags } from "./flags";

export default async function (
  this: LocalContext,
  flags: BaseFlags,
  newBaseRevision?: string,
): Promise<void> {
  const configPath = resolve(this.cwd, flags.config ?? DEFAULT_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return exit(this, {
      exitCode: 1,
      stderr: `Configuration file not found: ${configPath}`,
    });
  }

  const content = readFileSync(configPath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);

  if (!parseResult.success) {
    return exit(this, { exitCode: 1, stderr: parseResult.error });
  }

  const zodResult = jsonConfigSchema.safeParse(parseResult.json);
  if (!zodResult.success) {
    return exit(this, { exitCode: 1, stderr: "Invalid configuration file" });
  }

  const config = zodResult.data;
  const currentBase = config.base_revision ?? "";

  if (newBaseRevision !== undefined) {
    await updateBaseRevisionDirect(
      this,
      configPath,
      content,
      currentBase,
      newBaseRevision,
      flags.verbose ?? false,
    );
    return;
  }

  await updateBaseRevisionInteractive(
    this,
    configPath,
    content,
    config,
    currentBase,
    flags.verbose ?? false,
  );
}

const fetchAndValidateRemoteRefs = async (
  context: LocalContext,
  prompts: ReturnType<typeof createPrompts>,
  sourceRepo: string,
): Promise<Awaited<ReturnType<typeof fetchRemoteRefs>> | undefined> => {
  prompts.log.step(`Fetching upstream refs from ${chalk.cyan(sourceRepo)}...`);

  try {
    return await fetchRemoteRefs(sourceRepo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Failed to fetch remote refs: ${message}`),
    });
  }
};

const promptForBaseRevision = async (
  context: LocalContext,
  prompts: ReturnType<typeof createPrompts>,
  remoteRefs: Awaited<ReturnType<typeof fetchRemoteRefs>>,
  currentBase: string,
): Promise<string | undefined> => {
  const tags = getLatestTags(remoteRefs, 10);
  const branches = getBranches(remoteRefs);
  const baseOptions = buildBaseRevisionOptions(tags, branches);

  const selectedBase = await prompts.select({
    message: `Select new base revision (current: ${currentBase}):`,
    options: baseOptions,
  });

  if (prompts.isCancel(selectedBase)) {
    return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
  }

  if (selectedBase === MANUAL_SHA_OPTION) {
    const manualSha = await promptForManualSha(prompts);
    if (prompts.isCancel(manualSha)) {
      return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
    }
    return manualSha;
  }

  return selectedBase;
};

const writeConfigUpdate = async (
  context: LocalContext,
  prompts: ReturnType<typeof createPrompts> | undefined,
  configPath: string,
  content: string,
  newBase: string,
): Promise<boolean> => {
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
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Failed to update config: ${errorMessage}`),
    });
  }
};

const updateBaseRevisionDirect = async (
  context: LocalContext,
  configPath: string,
  content: string,
  currentBase: string,
  newBase: string,
  verbose: boolean,
): Promise<void> => {
  if (verbose) {
    context.process.stdout.write(`Current base_revision: ${currentBase}\n`);
    context.process.stdout.write(`New base_revision: ${newBase}\n`);
  }

  await writeConfigUpdate(context, undefined, configPath, content, newBase);
};

const updateBaseRevisionInteractive = async (
  context: LocalContext,
  configPath: string,
  content: string,
  config: JsonConfig,
  currentBase: string,
  verbose: boolean,
): Promise<void> => {
  if (!canPrompt(context)) {
    context.process.stdout.write(`Current base_revision: ${currentBase}\n`);
    context.process.stdout.write(
      "Interactive mode requires a TTY. Use direct mode: patchy base <revision>\n",
    );
    return;
  }

  if (!config.upstream_branch) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(
        "upstream_branch is required for interactive mode. Set it in your config or use direct mode: patchy base <revision>",
      ),
    });
  }

  if (!config.source_repo) {
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red("source_repo is required to fetch upstream refs"),
    });
  }

  const prompts = createPrompts(context);

  const remoteRefs = await fetchAndValidateRemoteRefs(
    context,
    prompts,
    config.source_repo,
  );
  if (!remoteRefs) return;

  const newBase = await promptForBaseRevision(
    context,
    prompts,
    remoteRefs,
    currentBase,
  );
  if (!newBase) return;

  if (verbose) {
    context.process.stdout.write(`\nCurrent base_revision: ${currentBase}\n`);
    context.process.stdout.write(`New base_revision: ${newBase}\n\n`);
  }

  await writeConfigUpdate(context, prompts, configPath, content, newBase);
};
