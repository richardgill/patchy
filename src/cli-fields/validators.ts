import { existsSync } from "node:fs";
import chalk from "chalk";
import { unwrapValue, type ValidatorFn } from "~/lib/cli-config";
import { isAbsolutePath } from "~/lib/fs";
import { isValidGitUrl } from "~/lib/validation";
import type { EnrichedFields } from "./enriched-fields";

type PatchyValidatorFn = ValidatorFn<
  EnrichedFields & { [key: string]: unknown }
>;

const checkPathExists = (value: string | undefined): string | null => {
  if (value && !existsSync(value)) {
    return `does not exist: ${chalk.blue(value)}`;
  }
  return null;
};

export const directoryExists: PatchyValidatorFn = (config, key) => {
  const value = unwrapValue(config[key]);
  return checkPathExists(typeof value === "string" ? value : undefined);
};

export const targetRepoExists: PatchyValidatorFn = (config, _key) => {
  const targetRepo = unwrapValue(config["target_repo"]);

  if (
    targetRepo &&
    typeof targetRepo === "string" &&
    isAbsolutePath(targetRepo)
  ) {
    return checkPathExists(config.absoluteTargetRepo);
  }
  // For relative paths, skip if clones_dir doesn't exist (caught by clones_dir validator)
  if (!config.absoluteClonesDir || !existsSync(config.absoluteClonesDir)) {
    return null;
  }
  return checkPathExists(config.absoluteTargetRepo);
};

export const gitUrl: PatchyValidatorFn = (config, key) => {
  const value = unwrapValue(config[key]);
  if (typeof value === "string" && !isValidGitUrl(value)) {
    return `is invalid. Example: https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo`;
  }
  return null;
};
