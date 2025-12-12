import { existsSync } from "node:fs";
import chalk from "chalk";
import type { ValidatorFn } from "~/lib/cli-config";
import { isValidGitUrl } from "~/lib/validation";
import type { EnrichedFields } from "./enriched-fields";

// Patchy validators use EnrichedFields as the config type
export type PatchyValidatorFn = ValidatorFn<EnrichedFields>;

// Helper to check if a path exists
const checkPathExists = (value: string | undefined): string | null => {
  if (value && !existsSync(value)) {
    return `does not exist: ${chalk.blue(value)}`;
  }
  return null;
};

export const directoryExists: PatchyValidatorFn = (config, key) => {
  const value = config[key];
  return checkPathExists(typeof value === "string" ? value : undefined);
};

export const repoDirExists: PatchyValidatorFn = (config, _key) => {
  // Skip validation if parent directory doesn't exist (will be caught by repo_base_dir validator)
  if (!config.absoluteRepoBaseDir || !existsSync(config.absoluteRepoBaseDir)) {
    return null;
  }
  return checkPathExists(config.absoluteRepoDir);
};

export const gitUrl: PatchyValidatorFn = (config, key) => {
  const value = config[key];
  if (typeof value === "string" && !isValidGitUrl(value)) {
    return `is invalid. Example repo: https://github.com/user/repo.git`;
  }
  return null;
};
