import { existsSync } from "node:fs";
import path, { resolve } from "node:path";
import type { MarkOptional } from "ts-essentials";
import type { LocalContext } from "../context";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { yamlConfigSchema } from "./schemas";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import type { YamlConfig } from "./schemas";
import {
  CONFIG_FIELD_METADATA,
  type PartialResolvedConfig,
  type ResolvedConfig,
  type SharedFlags,
  type YamlKey,
} from "./types";
import { isNil } from "es-toolkit";
import chalk from "chalk";

type ConfigError = { field: keyof ResolvedConfig } & (
  | {
      type: "nil";
    }
  | { type: "validation-error"; error: string }
);

type MergedConfig = MarkOptional<
  ResolvedConfig,
  | "repo_url"
  | "repo_dir"
  | "repo_base_dir"
  | "absoluteRepoBaseDir"
  | "absoluteRepoDir"
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
  flags: SharedFlags & { "repo-url"?: string; ref?: string };
  requiredFields: YamlKey[];
  configPath: string;
  configPathFlag: string | undefined;
  onConfigMerged?: (config: MergedConfig) => void;
}) => {
  const yamlConfig = parseOptionalYamlConfig(yamlString);
  console.log("zzz yamlConfig", yamlConfig);
  const repoBaseDir = flags["repo-base-dir"] ?? yamlConfig.repo_base_dir;
  const repoDir = flags["repo-dir"] ?? yamlConfig.repo_dir;
  const mergedConfig: MergedConfig = {
    repo_url: flags["repo-url"] ?? yamlConfig.repo_url,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    repo_base_dir: repoBaseDir,
    absoluteRepoBaseDir: repoBaseDir ? resolve(repoBaseDir) : undefined,
    repo_dir: repoDir,
    absoluteRepoDir:
      repoBaseDir && repoDir
        ? resolve(path.join(repoBaseDir, repoDir))
        : undefined,
    patches_dir:
      flags["patches-dir"] ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dry_run: flags["dry-run"] ?? false,
  };
  console.log("zzz mergedConfig", mergedConfig);

  onConfigMerged(mergedConfig);
  const errors = calcError({
    mergedConfig,
    requiredFields,
    configPath,
    configPathFlag,
  });

  return { mergedConfig, ...errors };
};

const calcError = ({
  mergedConfig,
  requiredFields,
  configPath,
  configPathFlag,
}: {
  mergedConfig: MergedConfig;
  requiredFields: YamlKey[];
  configPath: string;
  configPathFlag: string | undefined;
}): { success: boolean; error?: string } => {
  console.log("zzz ", { mergedConfig, requiredFields, configPathFlag });

  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });
  console.log("zzz missingFields", missingFields);
  if (missingFields.length > 0) {
    const missingFieldLines = missingFields.map((fieldKey) => {
      const field = CONFIG_FIELD_METADATA[fieldKey];
      return `  Missing ${chalk.bold(field.name)}: set ${chalk.cyan(fieldKey)} in ${chalk.blue(configPath)} or use ${chalk.cyan(`--${field.flag}`)} flag`;
    });

    const missingFieldsError =
      [
        chalk.red.bold("Missing required parameters:"),
        "",
        ...missingFieldLines,
        "",
        `${chalk.yellow("You can set up")} ${chalk.blue(configPath)} ${chalk.yellow("by running:")}`,
        `  ${chalk.bold(`patchy init${configPathFlag ? ` --config ${configPathFlag}` : ""}`)}`,
      ].join("\n") + "\n\n";

    return { success: false, error: missingFieldsError };
  }

  const validationErrors = [];
  const isRepoBaseDirValid =
    !requiredFields.includes("repo_base_dir") ||
    !mergedConfig.absoluteRepoBaseDir ||
    existsSync(mergedConfig.absoluteRepoBaseDir);
  if (!isRepoBaseDirValid) {
    validationErrors.push(
      `  ${chalk.bold(CONFIG_FIELD_METADATA.repo_base_dir.name)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoBaseDir)}`,
    );
  }
  if (
    isRepoBaseDirValid &&
    requiredFields.includes("repo_dir") &&
    mergedConfig.absoluteRepoDir &&
    !existsSync(mergedConfig.absoluteRepoDir)
  ) {
    validationErrors.push(
      `Resolved ${chalk.bold(CONFIG_FIELD_METADATA.repo_dir.name)} does not exist: ${chalk.blue(mergedConfig.absoluteRepoDir)}`,
    );
  }

  if (validationErrors.length > 0) {
    const validationError =
      [chalk.red.bold("Validation errors:"), "", ...validationErrors].join(
        "\n",
      ) + "\n\n";

    return { success: false, error: validationError };
  }

  return { success: true };
};

export const resolveConfig = async (
  context: LocalContext,
  flags: SharedFlags & { "repo-url"?: string; ref?: string },
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
