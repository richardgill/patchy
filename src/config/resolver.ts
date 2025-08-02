import { existsSync, readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import * as JSONC from "jsonc-parser";
import type { MarkOptional } from "ts-essentials";
import type { LocalContext } from "~/context";
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
  type PartialResolvedConfig,
  type ResolvedConfig,
  type SharedFlags,
} from "./types";
import { isValidGitUrl } from "./validation";

const getFlagOrJsonValue = <T>(
  flagValue: T | undefined,
  jsonValue: T | undefined,
): T | undefined => {
  return flagValue ?? jsonValue;
};

const getFlagOrJsonValueByKey = <K extends JsonKey>(
  jsonKey: K,
  flags: SharedFlags,
  jsonConfig: JsonConfig,
): JsonConfig[K] | undefined => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const flagValue = flags[metadata.flag as keyof typeof flags] as
    | JsonConfig[K]
    | undefined;
  return getFlagOrJsonValue(flagValue, jsonConfig[jsonKey]);
};

const formatFlagOrJsonSource = <K extends JsonKey>(
  jsonKey: K,
  flags: SharedFlags,
  jsonConfig: JsonConfig,
  configPath: string,
): string => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  const flagValue = flags[metadata.flag as keyof typeof flags];
  const jsonValue = jsonConfig[jsonKey];

  if (flagValue) {
    return `--${metadata.flag} ${flagValue}`;
  }
  if (jsonValue) {
    return `${jsonKey}: ${jsonValue} in ${configPath}`;
  }
  // default value
  return metadata.name;
};

type MergedConfig = MarkOptional<
  ResolvedConfig,
  | "repo_url"
  | "repo_dir"
  | "repo_base_dir"
  | "absoluteRepoBaseDir"
  | "absoluteRepoDir"
  | "absolutePatchesDir"
>;

export const parseOptionalJsonConfig = (
  jsonString: string | undefined,
): JsonConfig => {
  if (isNil(jsonString)) {
    return {};
  }
  const errors: JSONC.ParseError[] = [];
  const parsedData = JSONC.parseTree(jsonString, errors, {
    disallowComments: false,
    allowTrailingComma: true,
  });

  if (errors.length > 0) {
    throw new Error(
      `JSON parse error: ${JSONC.printParseErrorCode(errors[0].error)} at offset ${errors[0].offset}`,
    );
  }

  if (!parsedData) {
    throw new Error("Failed to parse JSON");
  }

  const jsonData = JSONC.getNodeValue(parsedData);
  const { data, success, error } = jsonConfigSchema.safeParse(jsonData);
  if (success) {
    return data;
  }
  // todo human format
  throw error;
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
}: {
  flags: SharedFlags;
  requiredFields: JsonKey[];
  onConfigMerged?: (config: MergedConfig) => void;
  cwd?: string;
}) => {
  const originalCwd = process.cwd();
  if (cwd) {
    process.chdir(cwd);
  }
  const configPath = flags.config ?? DEFAULT_CONFIG_PATH;
  const absoluteConfigPath = resolve(configPath);
  let jsonString: string | undefined;
  if (!existsSync(absoluteConfigPath) && flags.config !== undefined) {
    throw new Error(`Configuration file not found: ${absoluteConfigPath}`);
  }
  if (existsSync(absoluteConfigPath)) {
    jsonString = readFileSync(absoluteConfigPath, "utf8");
  }

  const jsonConfig = parseOptionalJsonConfig(jsonString);
  const repoBaseDir = getFlagOrJsonValueByKey(
    "repo_base_dir",
    flags,
    jsonConfig,
  );
  const repoDir = getFlagOrJsonValueByKey("repo_dir", flags, jsonConfig);
  const patchesDir =
    getFlagOrJsonValueByKey("patches_dir", flags, jsonConfig) ??
    DEFAULT_PATCHES_DIR;
  const mergedConfig: MergedConfig = {
    repo_url: getFlagOrJsonValueByKey("repo_url", flags, jsonConfig),
    ref: getFlagOrJsonValueByKey("ref", flags, jsonConfig) ?? DEFAULT_REF,
    repo_base_dir: repoBaseDir,
    absoluteRepoBaseDir: repoBaseDir ? resolve(repoBaseDir) : undefined,
    repo_dir: repoDir,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(path.join(repoBaseDir, repoDir))
        : undefined,
    patches_dir: patchesDir,
    absolutePatchesDir: patchesDir ? resolve(patchesDir) : undefined,
    verbose: getFlagOrJsonValueByKey("verbose", flags, jsonConfig) ?? false,
    dry_run: flags["dry-run"] ?? false,
  };

  onConfigMerged(mergedConfig);
  const errors = calcError({
    mergedConfig,
    requiredFields,
    configPath,
    jsonConfig,
    flags,
  });
  if (cwd) {
    process.chdir(originalCwd);
  }
  return { mergedConfig, ...errors };
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  jsonConfig,
  flags,
}: {
  mergedConfig: MergedConfig;
  requiredFields: JsonKey[];
  configPath: string;
  jsonConfig: JsonConfig;
  flags: SharedFlags;
}): { success: boolean; error?: string } => {
  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });
  if (missingFields.length > 0) {
    const missingFieldLines = missingFields.map((fieldKey) => {
      const field = CONFIG_FIELD_METADATA[fieldKey];
      return `  Missing ${chalk.bold(field.name)}: set ${chalk.cyan(fieldKey)} in ${chalk.blue(configPath)} or use ${chalk.cyan(`--${field.flag}`)} flag`;
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
      `${formatFlagOrJsonSource("repo_base_dir", flags, jsonConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoBaseDir)}`,
    );
  }
  if (
    isRepoBaseDirValid &&
    requiredFields.includes("repo_dir") &&
    mergedConfig.absoluteRepoDir &&
    !existsSync(mergedConfig.absoluteRepoDir)
  ) {
    validationErrors.push(
      `${formatFlagOrJsonSource("repo_dir", flags, jsonConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoDir)}`,
    );
  }

  if (
    requiredFields.includes("patches_dir") &&
    mergedConfig.absolutePatchesDir &&
    !existsSync(mergedConfig.absolutePatchesDir)
  ) {
    validationErrors.push(
      `${formatFlagOrJsonSource("patches_dir", flags, jsonConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absolutePatchesDir)}`,
    );
  }

  if (
    requiredFields.includes("repo_url") &&
    mergedConfig.repo_url &&
    !isValidGitUrl(mergedConfig.repo_url)
  ) {
    validationErrors.push(
      `${formatFlagOrJsonSource("repo_url", flags, jsonConfig, configPath)} is invalid.  Example repo: ${CONFIG_FIELD_METADATA.repo_url.example}`,
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
  const { mergedConfig, success, error } = createMergedConfig({
    flags,
    requiredFields,
    onConfigMerged: (config) => logConfiguration(context, config),
  });

  if (!success) {
    if (error) {
      context.process.stderr.write(error);
    }
    context.process.exit(1);
  }

  return mergedConfig;
};
