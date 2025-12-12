import { existsSync, readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import { parseJsonc } from "~/lib/jsonc";
import { isValidGitUrl } from "~/lib/validation";
import { formatZodErrorHuman } from "~/lib/zod";
import {
  type EnrichedMergedConfig,
  FLAG_METADATA,
  type FlagKey,
  getFlagName,
  JSON_CONFIG_KEYS,
  type JsonConfigKey,
  type MergedConfig,
  RUNTIME_FLAG_KEYS,
  type SharedFlags,
} from "./config";

import { DEFAULT_CONFIG_PATH } from "./defaults";
import type { JsonConfig } from "./schemas";
import { jsonConfigSchema } from "./schemas";

type ConfigSources = {
  flags: SharedFlags;
  env: NodeJS.ProcessEnv;
  json: JsonConfig;
};

type ConfigValues<K extends JsonConfigKey> = {
  flag: JsonConfig[K] | undefined;
  env: JsonConfig[K] | undefined;
  json: JsonConfig[K] | undefined;
};

// Get value from env var, converting to appropriate type
const getEnvValue = <K extends FlagKey>(
  key: K,
  env: NodeJS.ProcessEnv,
): unknown => {
  const metadata = FLAG_METADATA[key];
  const envValue = env[metadata.env];
  if (envValue === undefined || envValue === "") {
    return undefined;
  }
  if (metadata.type === "boolean") {
    return envValue.toLowerCase() === "true" || envValue === "1";
  }
  return envValue;
};

// Get value for a JSON config key from flags, env, or JSON (in priority order)
const getValuesByKey = <K extends JsonConfigKey>(
  key: K,
  sources: ConfigSources,
): ConfigValues<K> => {
  const flagName = getFlagName(key);
  return {
    flag: sources.flags[flagName as keyof SharedFlags] as
      | JsonConfig[K]
      | undefined,
    env: getEnvValue(key, sources.env) as JsonConfig[K] | undefined,
    json: sources.json[key],
  };
};

const getValueByKey = <K extends JsonConfigKey>(
  key: K,
  sources: ConfigSources,
): JsonConfig[K] | undefined => {
  const values = getValuesByKey(key, sources);
  return values.flag ?? values.env ?? values.json;
};

// Get value for a runtime-only flag from flags or env (no JSON source)
const getRuntimeFlagValue = <K extends FlagKey>(
  key: K,
  flags: SharedFlags,
  env: NodeJS.ProcessEnv,
): unknown => {
  const metadata = FLAG_METADATA[key];
  const flagName = getFlagName(key);
  const flagValue = flags[flagName as keyof SharedFlags];
  if (flagValue !== undefined) {
    return flagValue;
  }
  const envValue = getEnvValue(key, env);
  if (envValue !== undefined) {
    return envValue;
  }
  return "defaultValue" in metadata ? metadata.defaultValue : undefined;
};

const formatSourceLocation = <K extends JsonConfigKey>(
  key: K,
  sources: ConfigSources,
  configPath: string,
): string => {
  const metadata = FLAG_METADATA[key];
  const flagName = getFlagName(key);
  const values = getValuesByKey(key, sources);

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

const createMergedConfig = ({
  flags,
  cwd,
  env = process.env,
}: CreateMergedConfigParams):
  | {
      mergedConfig: MergedConfig;
      configPath: string;
      sources: ConfigSources;
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
  const sources: ConfigSources = { flags, env, json: parseResult.data };

  // Build config from JSON config fields
  const jsonConfig = Object.fromEntries(
    JSON_CONFIG_KEYS.map((key) => {
      const value = getValueByKey(key, sources);
      const metadata = FLAG_METADATA[key];
      const defaultVal =
        "defaultValue" in metadata ? metadata.defaultValue : undefined;
      return [key, value ?? defaultVal];
    }),
  );

  // Add runtime-only flags
  const runtimeFlags = Object.fromEntries(
    RUNTIME_FLAG_KEYS.filter((key) => key !== "config").map((key) => [
      key,
      getRuntimeFlagValue(key, flags, env),
    ]),
  );

  const mergedConfig: MergedConfig = {
    ...jsonConfig,
    ...runtimeFlags,
  } as MergedConfig;

  return { mergedConfig, configPath, sources, success: true };
};

export const createEnrichedMergedConfig = ({
  flags,
  requiredFields,
  cwd,
  env = process.env,
}: CreateEnrichedMergedConfigParams):
  | { mergedConfig: EnrichedMergedConfig; success: true }
  | { success: false; error: string } => {
  const result = createMergedConfig({ flags, cwd, env });
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
        ? resolve(cwd, path.join(repoBaseDir, repoDir))
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

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  sources,
}: {
  mergedConfig: EnrichedMergedConfig;
  requiredFields: JsonConfigKey[];
  configPath: string;
  sources: ConfigSources;
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

  const validationErrors = [];
  const isRepoBaseDirValid =
    !requiredFields.includes("repo_base_dir") ||
    !mergedConfig.absoluteRepoBaseDir ||
    existsSync(mergedConfig.absoluteRepoBaseDir);
  if (!isRepoBaseDirValid) {
    validationErrors.push(
      `${formatSourceLocation("repo_base_dir", sources, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoBaseDir)}`,
    );
  }
  if (
    isRepoBaseDirValid &&
    requiredFields.includes("repo_dir") &&
    mergedConfig.absoluteRepoDir &&
    !existsSync(mergedConfig.absoluteRepoDir)
  ) {
    validationErrors.push(
      `${formatSourceLocation("repo_dir", sources, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoDir)}`,
    );
  }

  if (
    requiredFields.includes("patches_dir") &&
    mergedConfig.absolutePatchesDir &&
    !existsSync(mergedConfig.absolutePatchesDir)
  ) {
    validationErrors.push(
      `${formatSourceLocation("patches_dir", sources, configPath)} does not exist: ${chalk.blue(mergedConfig.absolutePatchesDir)}`,
    );
  }

  if (
    requiredFields.includes("repo_url") &&
    mergedConfig.repo_url &&
    !isValidGitUrl(mergedConfig.repo_url)
  ) {
    validationErrors.push(
      `${formatSourceLocation("repo_url", sources, configPath)} is invalid.  Example repo: ${FLAG_METADATA.repo_url.example}`,
    );
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
