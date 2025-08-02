import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { LocalContext } from "../context";
import { parseOptionalYamlConfig } from "./yaml-config";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import type {
  PartialResolvedConfig,
  ResolvedConfig,
  SharedFlags,
} from "./types";
import type { YamlConfig } from "./schemas";
import { validateGitUrl, validatePath, validateRef } from "./validation";

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

export const resolveConfig = async (
  context: LocalContext,
  flags: SharedFlags & { "repo-url"?: string; ref?: string },
  requiredFields: (keyof ResolvedConfig)[],
): Promise<PartialResolvedConfig | ResolvedConfig> => {
  const configPath = resolve(flags.config ?? DEFAULT_CONFIG_PATH);

  let yamlConfig: YamlConfig = {};
  if (!existsSync(configPath) && flags.config !== undefined) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  if (existsSync(configPath)) {
    try {
      yamlConfig = parseOptionalYamlConfig(configPath);
    } catch (error) {
      throw new Error(`Failed to parse config file at ${configPath}: ${error}`);
    }
  }

  const mergedConfig = {
    repo_url: flags["repo-url"] ?? yamlConfig.repo_url,
    repo_dir: flags["repo-dir"] ?? yamlConfig.repo_dir,
    repo_base_dir: flags["repo-base-dir"] ?? yamlConfig.repo_base_dir,
    patches_dir:
      flags["patches-dir"] ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dry_run: flags["dry-run"] ?? false,
  };

  if (requiredFields.length > 0) {
    const missing: string[] = [];

    for (const field of requiredFields) {
      const configKey =
        field === "repo_url"
          ? "repo-url"
          : field === "repo_dir"
            ? "repo-dir"
            : field === "repo_base_dir"
              ? "repo-base-dir"
              : field === "patches_dir"
                ? "patches-dir"
                : field === "dry_run"
                  ? "dry-run"
                  : field;

      if (!mergedConfig[field] && mergedConfig[field] !== false) {
        missing.push(configKey);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration: ${missing.join(", ")}. ` +
          `Provide via CLI flags or in ${configPath}`,
      );
    }
  }

  logConfiguration(context, mergedConfig);
  return mergedConfig;
};
