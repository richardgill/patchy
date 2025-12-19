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
    this.process.stderr.write(`Configuration file not found: ${configPath}\n`);
    this.process.exit?.(1);
    return;
  }

  const content = readFileSync(configPath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);

  if (!parseResult.success) {
    this.process.stderr.write(parseResult.error);
    this.process.stderr.write("\n");
    this.process.exit?.(1);
    return;
  }

  const zodResult = jsonConfigSchema.safeParse(parseResult.json);
  if (!zodResult.success) {
    this.process.stderr.write("Invalid configuration file\n");
    this.process.exit?.(1);
    return;
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
    context.process.stderr.write(
      chalk.red(`Failed to fetch remote refs: ${message}\n`),
    );
    context.process.exit?.(1);
    return undefined;
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
    context.process.stderr.write("Operation cancelled\n");
    context.process.exit?.(1);
    return undefined;
  }

  if (selectedBase === MANUAL_SHA_OPTION) {
    const manualSha = await promptForManualSha(prompts);
    if (prompts.isCancel(manualSha)) {
      context.process.stderr.write("Operation cancelled\n");
      context.process.exit?.(1);
      return undefined;
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
    context.process.stderr.write(chalk.red(`${updateResult.error}\n`));
    context.process.exit?.(1);
    return false;
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
    context.process.stderr.write(
      chalk.red(`Failed to update config: ${errorMessage}\n`),
    );
    context.process.exit?.(1);
    return false;
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
    context.process.stderr.write(
      chalk.red(
        "upstream_branch is required for interactive mode. Set it in your config or use direct mode: patchy base <revision>\n",
      ),
    );
    context.process.exit?.(1);
    return;
  }

  if (!config.source_repo) {
    context.process.stderr.write(
      chalk.red("source_repo is required to fetch upstream refs\n"),
    );
    context.process.exit?.(1);
    return;
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
