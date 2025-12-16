import { existsSync } from "node:fs";
import chalk from "chalk";
import type { ValidatorFn } from "~/lib/cli-config";
import { isValidGitUrl } from "~/lib/validation";
import type { EnrichedFields } from "./enriched-fields";

// Patchy validators use EnrichedFields as the config type
type PatchyValidatorFn = ValidatorFn<
  EnrichedFields & { [key: string]: unknown } // Allow access to other config fields (e.g., source_repo, target_repo)
>;

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

export const targetRepoExists: PatchyValidatorFn = (config, _key) => {
  // Skip validation if parent directory doesn't exist (will be caught by clones_dir validator)
  if (!config.absoluteClonesDir || !existsSync(config.absoluteClonesDir)) {
    return null;
  }
  return checkPathExists(config.absoluteTargetRepo);
};

export const gitUrl: PatchyValidatorFn = (config, key) => {
  const value = config[key];
  if (typeof value === "string" && !isValidGitUrl(value)) {
    return `is invalid. Example: https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo`;
  }
  return null;
};
