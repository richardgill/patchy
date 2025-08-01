import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { OptionalConfigData } from "../yaml-config";
import { parseOptionalYamlConfig } from "../yaml-config";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
  DEFAULT_REPO_BASE_DIR,
} from "./defaults";
import type {
  PartialResolvedConfig,
  ResolvedConfig,
  SharedFlags,
} from "./types";

export const resolveConfig = async (
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
    repoDir: flags.repoDir ?? yamlConfig.repo_dir,
    repoBaseDir:
      flags.repoBaseDir ?? yamlConfig.repo_base_dir ?? DEFAULT_REPO_BASE_DIR,
    patchesDir:
      flags.patchesDir ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dryRun: flags.dryRun ?? false,
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

    return merged as ResolvedConfig;
  }

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
    repoDir: flags.repoDir ?? yamlConfig.repo_dir,
    repoBaseDir:
      flags.repoBaseDir ?? yamlConfig.repo_base_dir ?? DEFAULT_REPO_BASE_DIR,
    patchesDir:
      flags.patchesDir ?? yamlConfig.patches_dir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? yamlConfig.ref ?? DEFAULT_REF,
    verbose: flags.verbose ?? yamlConfig.verbose ?? false,
    dryRun: flags.dryRun ?? false,
  };
};
