import { existsSync, readFileSync } from "node:fs";
import yaml from "yaml";
import { ZodError } from "zod";

import {
  type OptionalConfigData,
  optionalConfigSchema,
  type RequiredConfigData,
  requiredConfigSchema,
} from "./yaml-config.js";

type BaseCommandFlags = {
  repoUrl?: string;
  repoDir?: string;
  repoBaseDir?: string;
  patchesDir?: string;
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
    repo_url: flags.repoUrl ?? yamlConfig?.repo_url,
    repo_dir: flags.repoDir ?? yamlConfig?.repo_dir,
    repo_base_dir: flags.repoBaseDir ?? yamlConfig?.repo_base_dir,
    patches_dir: flags.patchesDir ?? yamlConfig?.patches_dir,
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
  const configPath = flags.config ?? "./patchy.yaml";
  const yamlConfig = loadYamlConfig(configPath);
  const mergedConfig = mergeConfigWithFlags(yamlConfig, flags);
  return validateConfig(mergedConfig, configPath);
};
