import { join, resolve } from "node:path";
import chalk from "chalk";
import {
  type ConfigSources,
  loadConfigFromFile,
  validateConfig,
} from "~/lib/cli-config";
import { formatZodErrorHuman } from "~/lib/zod";
import { DEFAULT_CONFIG_PATH } from "./defaults";
import { FLAG_METADATA } from "./metadata";
import { type JsonConfig, jsonConfigSchema } from "./schema";
import type {
  EnrichedMergedConfig,
  JsonConfigKey,
  MergedConfig,
  SharedFlags,
} from "./types";

type PatchyConfigSources = ConfigSources<typeof FLAG_METADATA, JsonConfig>;

type CreateEnrichedMergedConfigParams = {
  flags: SharedFlags;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  requiredFields: JsonConfigKey[];
};

// Patchy-specific: compute absolute paths from relative config values
const enrichConfig = (
  config: MergedConfig,
  cwd: string,
): EnrichedMergedConfig => {
  const {
    clones_dir: clonesDir,
    repo_dir: repoDir,
    patches_dir: patchesDir,
  } = config;

  return {
    ...config,
    absoluteClonesDir: clonesDir ? resolve(cwd, clonesDir) : undefined,
    absoluteRepoDir:
      clonesDir && repoDir ? resolve(cwd, join(clonesDir, repoDir)) : undefined,
    absolutePatchesDir: patchesDir ? resolve(cwd, patchesDir) : undefined,
  };
};

// Patchy-specific: "patchy init" hint for error messages
const formatInitHint = (
  configPath: string,
  sources: PatchyConfigSources,
): string => {
  return `${chalk.yellow("You can set up")} ${chalk.blue(
    configPath,
  )} ${chalk.yellow("by running:")}\n  ${chalk.bold(
    `patchy init${
      sources.flags.config ? ` --config ${sources.flags.config}` : ""
    }`,
  )}`;
};

export const createEnrichedMergedConfig = ({
  flags,
  requiredFields,
  cwd,
  env = process.env,
}: CreateEnrichedMergedConfigParams):
  | { mergedConfig: EnrichedMergedConfig; success: true }
  | { success: false; error: string } => {
  const result = loadConfigFromFile({
    metadata: FLAG_METADATA,
    flags,
    cwd,
    env,
    defaultConfigPath: DEFAULT_CONFIG_PATH,
    configFlagKey: "config",
    schema: jsonConfigSchema,
    formatZodError: formatZodErrorHuman,
  });

  if (!result.success) {
    return result;
  }

  // Enrich with absolute paths
  const enrichedConfig = enrichConfig(result.mergedConfig as MergedConfig, cwd);

  const validationResult = validateConfig({
    metadata: FLAG_METADATA,
    mergedConfig: enrichedConfig,
    requiredFields,
    configPath: result.configPath,
    sources: result.sources,
    formatInitHint,
  });

  if (!validationResult.success) {
    return validationResult;
  }

  return { mergedConfig: enrichedConfig, success: true };
};
