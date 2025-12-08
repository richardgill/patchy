import { existsSync, readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import type { MarkOptional } from "ts-essentials";
import type { LocalContext } from "~/context";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import { parseJsonc } from "./jsonc";
import type { JsonConfig } from "./schemas";
import { jsonConfigSchema } from "./schemas";
import {
  CONFIG_FIELD_METADATA,
  type JsonKey,
  type PartialResolvedConfig,
  type ResolvedConfig,
  type SharedFlags,
} from "./types";
import { isValidGitUrl } from "./validation";

const getEnvValue = <K extends JsonKey>(
  jsonKey: K,
  env: NodeJS.ProcessEnv = process.env,
): JsonConfig[K] | undefined => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const envValue = env[metadata.env];
  if (envValue === undefined || envValue === "") {
    return undefined;
  }
  if (jsonKey === "verbose" || jsonKey === "dry_run") {
    return (envValue.toLowerCase() === "true" ||
      envValue === "1") as JsonConfig[K];
  }
  return envValue as JsonConfig[K];
};

const getFlagOrEnvOrJsonValue = <T>(
  flagValue: T | undefined,
  envValue: T | undefined,
  jsonValue: T | undefined,
): T | undefined => {
  return flagValue ?? envValue ?? jsonValue;
};

const getFlagOrEnvOrJsonValueByKey = <K extends JsonKey>(
  jsonKey: K,
  flags: SharedFlags,
  jsonConfig: JsonConfig,
  env: NodeJS.ProcessEnv = process.env,
): JsonConfig[K] | undefined => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const flagValue = flags[metadata.flag as keyof typeof flags] as
    | JsonConfig[K]
    | undefined;
  const envValue = getEnvValue(jsonKey, env);
  return getFlagOrEnvOrJsonValue(flagValue, envValue, jsonConfig[jsonKey]);
};

const formatFlagOrEnvOrJsonSource = <K extends JsonKey>(
  jsonKey: K,
  flags: SharedFlags,
  jsonConfig: JsonConfig,
  configPath: string,
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const flagValue = flags[metadata.flag as keyof typeof flags];
  const envValue = getEnvValue(jsonKey, env);
  const jsonValue = jsonConfig[jsonKey];

  if (flagValue) {
    return `--${metadata.flag} ${flagValue}`;
  }
  if (envValue !== undefined) {
    return `${metadata.env}=${env[metadata.env]}`;
  }
  if (jsonValue) {
    return `${jsonKey}: ${jsonValue} in ${configPath}`;
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

const logConfiguration = (
  context: LocalContext,
  config: ResolvedConfig | PartialResolvedConfig,
): void => {
  if (config.verbose) {
    context.process.stdout.write("Configuration resolved:\n");
    context.process.stdout.write(`  repo_url: ${config.repo_url}\n`);
    context.process.stdout.write(`  repo_dir: ${config.repo_dir}\n`);
    context.process.stdout.write(`  repo_base_dir: ${config.repo_base_dir}\n`);
    context.process.stdout.write(`  patches_dir: ${config.patches_dir}\n`);
    context.process.stdout.write(`  ref: ${config.ref}\n`);
    context.process.stdout.write(`  verbose: ${config.verbose}\n`);
    context.process.stdout.write(`  dry_run: ${config.dry_run}\n`);
  }
};

export const createMergedConfig = ({
  flags,
  requiredFields,
  onConfigMerged = () => null,
  cwd = process.cwd(),
  env = process.env,
}: {
  flags: SharedFlags;
  requiredFields: JsonKey[];
  onConfigMerged?: (config: MergedConfig) => void;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}):
  | { mergedConfig: MergedConfig; success: true }
  | { success: false; error: string } => {
  const originalCwd = process.cwd();
  if (cwd) {
    process.chdir(cwd);
  }
  const configPath =
    flags.config ?? env["PATCHY_CONFIG"] ?? DEFAULT_CONFIG_PATH;
  const configExplicitlySet =
    flags.config !== undefined || env["PATCHY_CONFIG"] !== undefined;
  const absoluteConfigPath = resolve(configPath);
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
  const jsonConfig = parseResult.data;
  const repoBaseDir = getFlagOrEnvOrJsonValueByKey(
    "repo_base_dir",
    flags,
    jsonConfig,
    env,
  );
  const repoDir = getFlagOrEnvOrJsonValueByKey(
    "repo_dir",
    flags,
    jsonConfig,
    env,
  );
  const patchesDir =
    getFlagOrEnvOrJsonValueByKey("patches_dir", flags, jsonConfig, env) ??
    DEFAULT_PATCHES_DIR;
  const mergedConfig: MergedConfig = {
    repo_url: getFlagOrEnvOrJsonValueByKey("repo_url", flags, jsonConfig, env),
    ref:
      getFlagOrEnvOrJsonValueByKey("ref", flags, jsonConfig, env) ??
      DEFAULT_REF,
    repo_base_dir: repoBaseDir,
    absoluteRepoBaseDir: repoBaseDir ? resolve(repoBaseDir) : undefined,
    repo_dir: repoDir,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(path.join(repoBaseDir, repoDir))
        : undefined,
    patches_dir: patchesDir,
    absolutePatchesDir: patchesDir ? resolve(patchesDir) : undefined,
    verbose:
      getFlagOrEnvOrJsonValueByKey("verbose", flags, jsonConfig, env) ?? false,
    dry_run:
      getFlagOrEnvOrJsonValueByKey("dry_run", flags, jsonConfig, env) ?? false,
  };

  onConfigMerged(mergedConfig);
  const errors = calcError({
    mergedConfig,
    requiredFields,
    configPath,
    jsonConfig,
    flags,
    env,
  });
  if (cwd) {
    process.chdir(originalCwd);
  }
  if (!errors.success) {
    return { success: false, error: errors.error };
  }
  return { mergedConfig, success: true };
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  jsonConfig,
  flags,
  env = process.env,
}: {
  mergedConfig: MergedConfig;
  requiredFields: JsonKey[];
  configPath: string;
  jsonConfig: JsonConfig;
  flags: SharedFlags;
  env?: NodeJS.ProcessEnv;
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
      `  ${chalk.bold(`patchy init${flags.config ? ` --config ${flags.config}` : ""}`)}`,
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
      `${formatFlagOrEnvOrJsonSource("repo_base_dir", flags, jsonConfig, configPath, env)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoBaseDir)}`,
    );
  }
  if (
    isRepoBaseDirValid &&
    requiredFields.includes("repo_dir") &&
    mergedConfig.absoluteRepoDir &&
    !existsSync(mergedConfig.absoluteRepoDir)
  ) {
    validationErrors.push(
      `${formatFlagOrEnvOrJsonSource("repo_dir", flags, jsonConfig, configPath, env)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoDir)}`,
    );
  }

  if (
    requiredFields.includes("patches_dir") &&
    mergedConfig.absolutePatchesDir &&
    !existsSync(mergedConfig.absolutePatchesDir)
  ) {
    validationErrors.push(
      `${formatFlagOrEnvOrJsonSource("patches_dir", flags, jsonConfig, configPath, env)} does not exist: ${chalk.blue(mergedConfig.absolutePatchesDir)}`,
    );
  }

  if (
    requiredFields.includes("repo_url") &&
    mergedConfig.repo_url &&
    !isValidGitUrl(mergedConfig.repo_url)
  ) {
    validationErrors.push(
      `${formatFlagOrEnvOrJsonSource("repo_url", flags, jsonConfig, configPath, env)} is invalid.  Example repo: ${CONFIG_FIELD_METADATA.repo_url.example}`,
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

export const resolveConfig = async (
  context: LocalContext,
  flags: SharedFlags,
  requiredFields: JsonKey[],
): Promise<PartialResolvedConfig | ResolvedConfig> => {
  const result = createMergedConfig({
    flags,
    requiredFields,
    onConfigMerged: (config) => logConfiguration(context, config),
  });

  if (!result.success) {
    context.process.stderr.write(result.error);
    context.process.exit(1);
  }

  return result.mergedConfig;
};
