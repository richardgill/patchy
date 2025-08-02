import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
import type {
  PartialResolvedConfig,
  ResolvedConfig,
  SharedFlags,
} from "./types";
import { isNil } from "es-toolkit";
import { success } from "zod/mini";
import dedent from "dedent";
import { config } from "node:process";

type ConfigError = { field: keyof ResolvedConfig } & (
  | {
      type: "nil";
    }
  | { type: "validation-error"; error: string }
);

type MergedConfig = MarkOptional<
  ResolvedConfig,
  "repo_url" | "repo_dir" | "repo_base_dir"
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
  requiredFields: (keyof ResolvedConfig)[];
  configPath: string;
  configPathFlag: string | undefined;
  onConfigMerged?: (config: MergedConfig) => void;
}) => {
  const yamlConfig = parseOptionalYamlConfig(yamlString);
  console.log("zzz yamlConfig", yamlConfig);
  const mergedConfig: MergedConfig = {
    repo_url: flags["repo-url"] ?? yamlConfig.repo_url,
    repo_dir: flags["repo-dir"] ?? yamlConfig.repo_dir,
    repo_base_dir: flags["repo-base-dir"] ?? yamlConfig.repo_base_dir,
    patches_dir:
      flags["patches-dir"] ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
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
  // todo extract this to a type
  requiredFields: (keyof ResolvedConfig)[];
  configPath: string;
  configPathFlag: string | undefined;
}): { success: boolean; error?: string } => {
  console.log("zzz ", { mergedConfig, requiredFields, configPathFlag });

  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });

  if (missingFields) {
    const missingFieldsError = dedent(`
    Missing required parameters:

    ${missingFields
      .map((field) => {
        return `  ${field} please set ${field} in ${configPath} or use --${field} flag`;
      })
      .join("\n\n")}

    You can set up ${configPath} by running: 
    patchy init${configPathFlag ? ` --config ${configPathFlag}` : ""}
  `);

    return { success: false, error: missingFieldsError };
  }
  return { success: true };
};

export const resolveConfig = async (
  context: LocalContext,
  flags: SharedFlags & { "repo-url"?: string; ref?: string },
  requiredFields: (keyof ResolvedConfig)[],
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
    console.log("zzz error", error);
    throw new Error(`Configuration errors`);
  }

  return mergedConfig;
};
