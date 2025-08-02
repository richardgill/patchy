import { existsSync, readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { isNil } from "es-toolkit";
import type { MarkOptional } from "ts-essentials";
import YAML from "yaml";
import type { LocalContext } from "../context";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import type { YamlConfig } from "./schemas";
import { yamlConfigSchema } from "./schemas";
import {
  CONFIG_FIELD_METADATA,
  type PartialResolvedConfig,
  type ResolvedConfig,
  type SharedFlags,
  type YamlKey,
} from "./types";

const getFlagOrYamlValue = <T>(
  flagValue: T | undefined,
  yamlValue: T | undefined,
): T | undefined => {
  return flagValue ?? yamlValue;
};

const getFlagOrYamlValueByKey = <K extends YamlKey>(
  yamlKey: K,
  flags: SharedFlags,
  yamlConfig: YamlConfig,
): YamlConfig[K] | undefined => {
  const metadata = CONFIG_FIELD_METADATA[yamlKey];
  const flagValue = flags[metadata.flag as keyof typeof flags] as
    | YamlConfig[K]
    | undefined;
  return getFlagOrYamlValue(flagValue, yamlConfig[yamlKey]);
};

const formatFlagOrYamlSource = <K extends YamlKey>(
  yamlKey: K,
  flags: SharedFlags,
  yamlConfig: YamlConfig,
  configPath: string,
): string => {
  const metadata = CONFIG_FIELD_METADATA[yamlKey];
  const flagValue = flags[metadata.flag as keyof typeof flags];
  const yamlValue = yamlConfig[yamlKey];

  if (flagValue) {
    return `--${metadata.flag} ${flagValue}`;
  }
  if (yamlValue) {
    return `${yamlKey}: ${yamlValue} in ${configPath}`;
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

export const parseOptionalYamlConfig = (
  yamlString: string | undefined,
): YamlConfig => {
  if (isNil(yamlString)) {
    return {};
  }
  const parsedData = YAML.parse(yamlString);
  const { data, success, error } = yamlConfigSchema.safeParse(parsedData);
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
  yamlString,
  flags,
  requiredFields,
  configPath,
  configPathFlag,
  onConfigMerged = () => null,
}: {
  yamlString: string | undefined;
  flags: SharedFlags;
  requiredFields: YamlKey[];
  configPath: string;
  configPathFlag: string | undefined;
  onConfigMerged?: (config: MergedConfig) => void;
}) => {
  const yamlConfig = parseOptionalYamlConfig(yamlString);
  const repoBaseDir = getFlagOrYamlValueByKey(
    "repo_base_dir",
    flags,
    yamlConfig,
  );
  const repoDir = getFlagOrYamlValueByKey("repo_dir", flags, yamlConfig);
  const patchesDir =
    getFlagOrYamlValueByKey("patches_dir", flags, yamlConfig) ??
    DEFAULT_PATCHES_DIR;
  const mergedConfig: MergedConfig = {
    repo_url: getFlagOrYamlValueByKey("repo_url", flags, yamlConfig),
    ref: getFlagOrYamlValueByKey("ref", flags, yamlConfig) ?? DEFAULT_REF,
    repo_base_dir: repoBaseDir,
    absoluteRepoBaseDir: repoBaseDir ? resolve(repoBaseDir) : undefined,
    repo_dir: repoDir,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(path.join(repoBaseDir, repoDir))
        : undefined,
    patches_dir: patchesDir,
    absolutePatchesDir: patchesDir ? resolve(patchesDir) : undefined,
    verbose: getFlagOrYamlValueByKey("verbose", flags, yamlConfig) ?? false,
    dry_run: flags["dry-run"] ?? false,
  };

  onConfigMerged(mergedConfig);
  const errors = calcError({
    mergedConfig,
    requiredFields,
    configPath,
    configPathFlag,
    yamlConfig,
    flags,
  });

  return { mergedConfig, ...errors };
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  configPathFlag,
  yamlConfig,
  flags,
}: {
  mergedConfig: MergedConfig;
  requiredFields: YamlKey[];
  configPath: string;
  configPathFlag: string | undefined;
  yamlConfig: YamlConfig;
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
      `  ${chalk.bold(`patchy init${configPathFlag ? ` --config ${configPathFlag}` : ""}`)}`,
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
      `${formatFlagOrYamlSource("repo_base_dir", flags, yamlConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoBaseDir)}`,
    );
  }
  if (
    isRepoBaseDirValid &&
    requiredFields.includes("repo_dir") &&
    mergedConfig.absoluteRepoDir &&
    !existsSync(mergedConfig.absoluteRepoDir)
  ) {
    validationErrors.push(
      `${formatFlagOrYamlSource("repo_dir", flags, yamlConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoDir)}`,
    );
  }
  if (
    requiredFields.includes("patches_dir") &&
    mergedConfig.absolutePatchesDir &&
    !existsSync(mergedConfig.absolutePatchesDir)
  ) {
    validationErrors.push(
      `${formatFlagOrYamlSource("patches_dir", flags, yamlConfig, configPath)} does not exist: ${chalk.blue(mergedConfig.absolutePatchesDir)}`,
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
  requiredFields: YamlKey[],
): Promise<PartialResolvedConfig | ResolvedConfig> => {
  const configPath = flags.config ?? DEFAULT_CONFIG_PATH;
  const absoluteConfigPath = resolve(configPath);
  let yamlString: string | undefined;
  if (!existsSync(absoluteConfigPath) && flags.config !== undefined) {
    throw new Error(`Configuration file not found: ${absoluteConfigPath}`);
  }
  if (existsSync(absoluteConfigPath)) {
    yamlString = readFileSync(absoluteConfigPath, "utf8");
  }

  const { mergedConfig, success, error } = createMergedConfig({
    yamlString,
    flags,
    requiredFields,
    configPath,
    configPathFlag: flags.config,
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
