import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import {
  type ConfigSources,
  createMergedConfig,
  getValuesByKey,
} from "~/lib/cli-config";
import { parseJsonc } from "~/lib/jsonc";
import { formatZodErrorHuman } from "~/lib/zod";
import { DEFAULT_CONFIG_PATH } from "./defaults";
import { FLAG_METADATA } from "./metadata";
import { type JsonConfig, jsonConfigSchema } from "./schema";
import {
  type EnrichedMergedConfig,
  type FlagKey,
  getFlagName,
  type JsonConfigKey,
  type MergedConfig,
  type SharedFlags,
} from "./types";

type PatchyConfigSources = ConfigSources<typeof FLAG_METADATA, JsonConfig>;

type ConfigParseResult =
  | { success: true; data: JsonConfig }
  | { success: false; error: string };

export const parseOptionalJsonConfig = (
  jsonString: string | undefined,
): ConfigParseResult => {
  if (isNil(jsonString)) {
    return { success: true, data: {} };
  }

  const parseResult = parseJsonc<unknown>(jsonString);

  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  const { data, success, error } = jsonConfigSchema.safeParse(parseResult.json);
  if (success) {
    return { success: true, data };
  }

  return { success: false, error: formatZodErrorHuman(error) };
};

type CreateMergedConfigParams = {
  flags: SharedFlags;
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

type CreateEnrichedMergedConfigParams = CreateMergedConfigParams & {
  requiredFields: JsonConfigKey[];
};

const createPatchyMergedConfig = ({
  flags,
  cwd,
  env = process.env,
}: CreateMergedConfigParams):
  | {
      mergedConfig: MergedConfig;
      configPath: string;
      sources: PatchyConfigSources;
      success: true;
    }
  | { success: false; error: string } => {
  const configMeta = FLAG_METADATA.config;
  const configPath = flags.config ?? env[configMeta.env] ?? DEFAULT_CONFIG_PATH;
  const configExplicitlySet =
    flags.config !== undefined || env[configMeta.env] !== undefined;
  const absoluteConfigPath = resolve(cwd, configPath);

  let jsonString: string | undefined;
  if (!existsSync(absoluteConfigPath) && configExplicitlySet) {
    return {
      success: false,
      error: `Configuration file not found: ${absoluteConfigPath}`,
    };
  }
  if (existsSync(absoluteConfigPath)) {
    jsonString = readFileSync(absoluteConfigPath, "utf8");
  }

  const parseResult = parseOptionalJsonConfig(jsonString);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
    };
  }

  const { mergedConfig, sources } = createMergedConfig({
    metadata: FLAG_METADATA,
    flags,
    env,
    json: parseResult.data,
  });

  return {
    mergedConfig: mergedConfig as MergedConfig,
    configPath,
    sources,
    success: true,
  };
};

export const createEnrichedMergedConfig = ({
  flags,
  requiredFields,
  cwd,
  env = process.env,
}: CreateEnrichedMergedConfigParams):
  | { mergedConfig: EnrichedMergedConfig; success: true }
  | { success: false; error: string } => {
  const result = createPatchyMergedConfig({ flags, cwd, env });
  if (!result.success) {
    return result;
  }

  const { mergedConfig, configPath, sources } = result;
  const {
    repo_base_dir: repoBaseDir,
    repo_dir: repoDir,
    patches_dir: patchesDir,
  } = mergedConfig;

  const enrichedConfig: EnrichedMergedConfig = {
    ...mergedConfig,
    absoluteRepoBaseDir: repoBaseDir ? resolve(cwd, repoBaseDir) : undefined,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(cwd, join(repoBaseDir, repoDir))
        : undefined,
    absolutePatchesDir: patchesDir ? resolve(cwd, patchesDir) : undefined,
  };

  const errors = calcError({
    mergedConfig: enrichedConfig,
    requiredFields,
    configPath,
    sources,
  });
  if (!errors.success) {
    return { success: false, error: errors.error };
  }
  return { mergedConfig: enrichedConfig, success: true };
};

const formatSourceLocation = (
  key: JsonConfigKey,
  sources: PatchyConfigSources,
  configPath: string,
): string => {
  const metadata = FLAG_METADATA[key];
  const flagName = getFlagName(key);
  const values = getValuesByKey(FLAG_METADATA, key, sources);

  if (values.flag) {
    return `--${flagName} ${values.flag}`;
  }
  if (values.env !== undefined) {
    return `${metadata.env}=${sources.env[metadata.env]}`;
  }
  if (values.json) {
    return `${key}: ${values.json} in ${configPath}`;
  }
  return metadata.name;
};

const getValueToValidate = (
  key: FlagKey,
  config: EnrichedMergedConfig,
): string | undefined => {
  const absoluteKeyMap: Partial<Record<FlagKey, keyof EnrichedMergedConfig>> = {
    repo_base_dir: "absoluteRepoBaseDir",
    repo_dir: "absoluteRepoDir",
    patches_dir: "absolutePatchesDir",
  };
  const absoluteKey = absoluteKeyMap[key];
  if (absoluteKey) {
    return config[absoluteKey] as string | undefined;
  }
  return config[key] as string | undefined;
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  sources,
}: {
  mergedConfig: EnrichedMergedConfig;
  requiredFields: JsonConfigKey[];
  configPath: string;
  sources: PatchyConfigSources;
}): { success: true } | { success: false; error: string } => {
  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });
  if (missingFields.length > 0) {
    const missingFieldLines = missingFields.map((fieldKey) => {
      const field = FLAG_METADATA[fieldKey];
      const flagName = getFlagName(fieldKey);
      return `  Missing ${chalk.bold(field.name)}: set ${chalk.cyan(fieldKey)} in ${chalk.blue(configPath)}, ${chalk.cyan(field.env)} env var, or ${chalk.cyan(`--${flagName}`)} flag`;
    });

    const missingFieldsError = `${[
      chalk.red.bold("Missing required parameters:"),
      "",
      ...missingFieldLines,
      "",
      `${chalk.yellow("You can set up")} ${chalk.blue(configPath)} ${chalk.yellow("by running:")}`,
      `  ${chalk.bold(`patchy init${sources.flags.config ? ` --config ${sources.flags.config}` : ""}`)}`,
    ].join("\n")}\n\n`;

    return { success: false, error: missingFieldsError };
  }

  const validationErrors: string[] = [];

  for (const key of requiredFields) {
    const metadata = FLAG_METADATA[key];
    if (!("validate" in metadata) || !metadata.validate) continue;

    const value = getValueToValidate(key, mergedConfig);
    const error = metadata.validate(value, key, mergedConfig);

    if (error) {
      validationErrors.push(
        `${formatSourceLocation(key, sources, configPath)} ${error}`,
      );
    }
  }

  if (validationErrors.length > 0) {
    const validationError = `${[
      chalk.red.bold("Validation errors:"),
      "",
      ...validationErrors,
    ].join("\n")}\n\n`;

    return { success: false, error: validationError };
  }

  return { success: true };
};
