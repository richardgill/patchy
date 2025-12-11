import { existsSync, readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import type { MarkOptional } from "ts-essentials";
import { PATCHY_CONFIG_ENV_VAR } from "~/constants";
import { parseJsonc } from "~/lib/jsonc";
import { isValidGitUrl } from "~/lib/validation";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import type { JsonConfig } from "./schemas";
import { jsonConfigSchema } from "./schemas";
import {
  CONFIG_FIELD_METADATA,
  type JsonKey,
  type ResolvedConfig,
  type SharedFlags,
} from "./types";

type ConfigSources = {
  flags: SharedFlags;
  env: NodeJS.ProcessEnv;
  json: JsonConfig;
};

type ConfigValues<K extends JsonKey> = {
  flag: JsonConfig[K] | undefined;
  env: JsonConfig[K] | undefined;
  json: JsonConfig[K] | undefined;
};

const getEnvValue = <K extends JsonKey>(
  jsonKey: K,
  env: NodeJS.ProcessEnv,
): JsonConfig[K] | undefined => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const envValue = env[metadata.env];
  if (envValue === undefined || envValue === "") {
    return undefined;
  }
  if (metadata.type === "boolean") {
    return (envValue.toLowerCase() === "true" ||
      envValue === "1") as JsonConfig[K];
  }
  return envValue as JsonConfig[K];
};

const getValuesByKey = <K extends JsonKey>(
  jsonKey: K,
  sources: ConfigSources,
): ConfigValues<K> => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  return {
    flag: sources.flags[metadata.flag as keyof SharedFlags] as
      | JsonConfig[K]
      | undefined,
    env: getEnvValue(jsonKey, sources.env),
    json: sources.json[jsonKey],
  };
};

const getValueByKey = <K extends JsonKey>(
  jsonKey: K,
  sources: ConfigSources,
): JsonConfig[K] | undefined => {
  const values = getValuesByKey(jsonKey, sources);
  return values.flag ?? values.env ?? values.json;
};

const formatSourceLocation = <K extends JsonKey>(
  jsonKey: K,
  sources: ConfigSources,
  configPath: string,
): string => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const values = getValuesByKey(jsonKey, sources);

  if (values.flag) {
    return `--${metadata.flag} ${values.flag}`;
  }
  if (values.env !== undefined) {
    return `${metadata.env}=${sources.env[metadata.env]}`;
  }
  if (values.json) {
    return `${jsonKey}: ${values.json} in ${configPath}`;
  }
  return metadata.name;
};

export type MergedConfig = MarkOptional<
  ResolvedConfig,
  | "repo_url"
  | "repo_dir"
  | "repo_base_dir"
  | "absoluteRepoBaseDir"
  | "absoluteRepoDir"
  | "absolutePatchesDir"
>;

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

  // Format zod errors in a human-readable way
  if (error.issues && error.issues.length > 0) {
    const zodErrors = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `  ${path}${issue.message}`;
      })
      .join("\n");
    return { success: false, error: zodErrors.trim() };
  }
  return { success: false, error: error.message };
};

export const createMergedConfig = ({
  flags,
  requiredFields,
  onConfigMerged = () => null,
  cwd,
  env = process.env,
}: {
  flags: SharedFlags;
  requiredFields: JsonKey[];
  onConfigMerged?: (config: MergedConfig) => void;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}):
  | { mergedConfig: MergedConfig; success: true }
  | { success: false; error: string } => {
  const configPath =
    flags.config ?? env[PATCHY_CONFIG_ENV_VAR] ?? DEFAULT_CONFIG_PATH;
  const configExplicitlySet =
    flags.config !== undefined || env[PATCHY_CONFIG_ENV_VAR] !== undefined;
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
  const repoBaseDir = getValueByKey("repo_base_dir", sources);
  const repoDir = getValueByKey("repo_dir", sources);
  const patchesDir =
    getValueByKey("patches_dir", sources) ?? DEFAULT_PATCHES_DIR;
  const mergedConfig: MergedConfig = {
    repo_url: getValueByKey("repo_url", sources),
    ref: getValueByKey("ref", sources) ?? DEFAULT_REF,
    repo_base_dir: repoBaseDir,
    absoluteRepoBaseDir: repoBaseDir ? resolve(cwd, repoBaseDir) : undefined,
    repo_dir: repoDir,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(cwd, path.join(repoBaseDir, repoDir))
        : undefined,
    patches_dir: patchesDir,
    absolutePatchesDir: patchesDir ? resolve(cwd, patchesDir) : undefined,
    verbose: getValueByKey("verbose", sources) ?? false,
    dry_run: getValueByKey("dry_run", sources) ?? false,
  };

  onConfigMerged(mergedConfig);
  const errors = calcError({
    mergedConfig,
    requiredFields,
    configPath,
    sources,
  });
  if (!errors.success) {
    return { success: false, error: errors.error };
  }
  return { mergedConfig, success: true };
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  sources,
}: {
  mergedConfig: MergedConfig;
  requiredFields: JsonKey[];
  configPath: string;
  sources: ConfigSources;
}): { success: true } | { success: false; error: string } => {
  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });
  if (missingFields.length > 0) {
    const missingFieldLines = missingFields.map((fieldKey) => {
      const field = CONFIG_FIELD_METADATA[fieldKey];
      return `  Missing ${chalk.bold(field.name)}: set ${chalk.cyan(fieldKey)} in ${chalk.blue(configPath)}, ${chalk.cyan(field.env)} env var, or ${chalk.cyan(`--${field.flag}`)} flag`;
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
      `${formatSourceLocation("repo_url", sources, configPath)} is invalid.  Example repo: ${CONFIG_FIELD_METADATA.repo_url.example}`,
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
