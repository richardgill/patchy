import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { LocalContext } from "../context";
import type { OptionalConfigData } from "../yaml-config";
import { parseOptionalYamlConfig } from "../yaml-config";
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

const logConfiguration = (
  context: LocalContext,
  config: ResolvedConfig | PartialResolvedConfig,
): void => {
  if (config.verbose) {
    context.process.stdout.write("Configuration resolved:\n");
    context.process.stdout.write(`  repo_url: ${config.repoUrl}\n`);
    context.process.stdout.write(`  repo_dir: ${config.repoDir}\n`);
    context.process.stdout.write(`  repo_base_dir: ${config.repoBaseDir}\n`);
    context.process.stdout.write(`  patches_dir: ${config.patchesDir}\n`);
    context.process.stdout.write(`  ref: ${config.ref}\n`);
    context.process.stdout.write(`  verbose: ${config.verbose}\n`);
    context.process.stdout.write(`  dry_run: ${config.dryRun}\n`);
  }
};

export const resolveConfig = async (
  context: LocalContext,
  flags: SharedFlags & { repoUrl?: string; ref?: string },
  requireAll: boolean = true,
): Promise<PartialResolvedConfig | ResolvedConfig> => {
  const configPath = resolve(flags.config ?? DEFAULT_CONFIG_PATH);
  const isExplicitConfig = flags.config !== undefined;

  let yamlConfig: OptionalConfigData = {};
  if (existsSync(configPath)) {
    try {
      yamlConfig = parseOptionalYamlConfig(configPath);
    } catch (error) {
      throw new Error(`Failed to parse config file at ${configPath}: ${error}`);
    }
  } else if (isExplicitConfig) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const merged: PartialResolvedConfig = {
    repoUrl: flags.repoUrl ?? yamlConfig.repo_url,
    repoDir: flags["repo-dir"] ?? yamlConfig.repo_dir,
    repoBaseDir: flags["repo-base-dir"] ?? yamlConfig.repo_base_dir,
    patchesDir:
      flags["patches-dir"] ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dryRun: flags["dry-run"] ?? false,
  };

  if (requireAll) {
    const missing: string[] = [];
    if (!merged.repoUrl) missing.push("repo-url");
    if (!merged.repoDir) missing.push("repo-dir");

    if (missing.length > 0) {
      throw new Error(
        `Missing required configuration: ${missing.join(", ")}. ` +
          `Provide via CLI flags or in ${configPath}`,
      );
    }

    const resolved = merged as ResolvedConfig;
    logConfiguration(context, resolved);
    return resolved;
  }

  logConfiguration(context, merged);
  return merged;
};

export const loadConfigWithDefaults = (
  flags: SharedFlags & { repoUrl?: string; ref?: string },
): PartialResolvedConfig => {
  const configPath = resolve(flags.config ?? DEFAULT_CONFIG_PATH);

  let yamlConfig: OptionalConfigData = {};
  if (existsSync(configPath)) {
    try {
      yamlConfig = parseOptionalYamlConfig(configPath);
    } catch {
      // Silently ignore parse errors for optional loading
    }
  }

  return {
    repoUrl: flags.repoUrl ?? yamlConfig.repo_url,
    repoDir: flags["repo-dir"] ?? yamlConfig.repo_dir,
    repoBaseDir: flags["repo-base-dir"] ?? yamlConfig.repo_base_dir,
    patchesDir:
      flags["patches-dir"] ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dryRun: flags["dry-run"] ?? false,
  };
};
