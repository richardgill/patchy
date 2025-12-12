import { existsSync } from "node:fs";
import chalk from "chalk";
import { isValidGitUrl } from "~/lib/validation";
import type { EnrichedMergedConfig, FlagKey } from "./config";

// Returns error message or null if valid
export type ValidatorFn = (
  value: string | undefined,
  key: FlagKey,
  config: EnrichedMergedConfig,
) => string | null;

export const directoryExists: ValidatorFn = (path) => {
  if (path && !existsSync(path)) {
    return `does not exist: ${chalk.blue(path)}`;
  }
  return null;
};

export const repoDirExists: ValidatorFn = (path, _key, config) => {
  // Skip validation if parent directory doesn't exist (will be caught by repo_base_dir validator)
  if (!config.absoluteRepoBaseDir || !existsSync(config.absoluteRepoBaseDir)) {
    return null;
  }
  return directoryExists(path, _key, config);
};

export const gitUrl: ValidatorFn = (value) => {
  if (typeof value === "string" && !isValidGitUrl(value)) {
    return `is invalid. Example repo: https://github.com/user/repo.git`;
  }
  return null;
};
