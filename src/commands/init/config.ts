import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { omitBy } from "es-toolkit";
import {
  DEFAULT_CONFIG_PATH,
  getDefaultValue,
  type JsonConfig,
  jsonConfigSchema,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { isValidGitUrl } from "~/lib/validation";
import { getSchemaUrl } from "~/version";
import type { InitFlags } from "./flags";

export type PromptAnswers = {
  patchesDir?: string;
  clonesDir?: string;
  addToGitignore?: boolean;
  repoUrl?: string;
  baseRevision?: string;
  upstreamBranch?: string;
};

export const validatePreConditions = async (
  context: LocalContext,
  flags: InitFlags,
): Promise<void> => {
  const configPath = resolve(context.cwd, flags.config ?? DEFAULT_CONFIG_PATH);

  if (!flags.force && existsSync(configPath)) {
    return exit(context, {
      exitCode: 1,
      stderr: `Configuration file already exists at ${configPath}\nUse --force to overwrite`,
    });
  }

  if (flags["source-repo"] !== undefined) {
    if (!flags["source-repo"].trim()) {
      return exit(context, {
        exitCode: 1,
        stderr: "Repository URL is required",
      });
    }
    if (!isValidGitUrl(flags["source-repo"])) {
      return exit(context, {
        exitCode: 1,
        stderr:
          "Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)",
      });
    }
  }
};

export const buildFinalConfig = (
  flags: InitFlags,
  answers: PromptAnswers,
  defaultClonesDir: string,
): JsonConfig => {
  const clonesDir =
    flags["clones-dir"] ?? answers.clonesDir ?? defaultClonesDir;

  return {
    source_repo: flags["source-repo"] ?? answers.repoUrl ?? "",
    clones_dir: clonesDir,
    patches_dir:
      flags["patches-dir"] ??
      answers.patchesDir ??
      getDefaultValue("patches_dir") ??
      "",
    base_revision:
      flags["base-revision"] ??
      answers.baseRevision ??
      getDefaultValue("base_revision") ??
      "",
    ...(flags["upstream-branch"] !== undefined
      ? { upstream_branch: flags["upstream-branch"] }
      : answers.upstreamBranch !== undefined
        ? { upstream_branch: answers.upstreamBranch }
        : {}),
  };
};

export const generateJsonConfig = async (
  config: JsonConfig,
): Promise<string> => {
  const validatedConfig = jsonConfigSchema.parse(config);

  const cleanedConfig = omitBy(
    validatedConfig,
    (value, key) =>
      value === "" ||
      value == null ||
      key === "$schema" ||
      (key === "verbose" && value === false),
  );

  const jsonData = {
    $schema: await getSchemaUrl(),
    ...cleanedConfig,
  };

  return `${JSON.stringify(jsonData, null, 2)}\n`;
};
