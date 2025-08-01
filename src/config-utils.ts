import { existsSync, readFileSync } from "node:fs";
import yaml from "yaml";
import { ZodError } from "zod";
import { DEFAULT_CONFIG_PATH } from "./config/defaults";
import {
  type OptionalConfigData,
  optionalConfigSchema,
  type RequiredConfigData,
  requiredConfigSchema,
} from "./yaml-config";

type BaseCommandFlags = {
  "repo-url"?: string;
  "repo-dir"?: string;
  "repo-base-dir"?: string;
  "patches-dir"?: string;
  ref?: string;
  config?: string;
};

const FIELD_TO_FLAG_MAP = {
  repo_url: "--repo-url",
  repo_dir: "--repo-dir",
  repo_base_dir: "--repo-base-dir",
  patches_dir: "--patches-dir",
  ref: "--ref",
} as const;

export const loadYamlConfig = (
  configPath: string,
): OptionalConfigData | null => {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const fileContent = readFileSync(configPath, "utf8");
    const parsedData = yaml.parse(fileContent);
    return optionalConfigSchema.parse(parsedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to parse config file at ${configPath}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const mergeConfigWithFlags = (
  yamlConfig: OptionalConfigData | null,
  flags: BaseCommandFlags,
): OptionalConfigData => {
  return {
    repo_url: flags["repo-url"] ?? yamlConfig?.repo_url,
    repo_dir: flags["repo-dir"] ?? yamlConfig?.repo_dir,
    repo_base_dir: flags["repo-base-dir"] ?? yamlConfig?.repo_base_dir,
    patches_dir: flags["patches-dir"] ?? yamlConfig?.patches_dir,
    ref: flags.ref ?? yamlConfig?.ref,
  };
};

export const validateConfig = (
  config: OptionalConfigData,
  configPath: string,
): RequiredConfigData => {
  try {
    return requiredConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages: string[] = ["Configuration validation failed:\n"];

      for (const issue of error.issues) {
        const field = issue.path[0] as keyof typeof FIELD_TO_FLAG_MAP;
        const flag = FIELD_TO_FLAG_MAP[field];

        messages.push(`Missing required field: ${field}`);
        messages.push(`  Set via CLI flag: ${flag} <value>`);
        messages.push(`  Or in ${configPath}:`);
        messages.push(`    ${field}: <value>\n`);
      }

      throw new Error(messages.join("\n"));
    }
    throw error;
  }
};

export const getValidatedConfig = (
  flags: BaseCommandFlags,
): RequiredConfigData => {
  const configPath = flags.config ?? DEFAULT_CONFIG_PATH;
  const yamlConfig = loadYamlConfig(configPath);
  const mergedConfig = mergeConfigWithFlags(yamlConfig, flags);
  return validateConfig(mergedConfig, configPath);
};
