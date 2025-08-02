import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isNil } from "es-toolkit";
import { z } from "zod";
import type { LocalContext } from "../context";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "./defaults";
import type { YamlConfig } from "./schemas";
import type {
  PartialResolvedConfig,
  ResolvedConfig,
  SharedFlags,
} from "./types";
import { isValidGitUrl } from "./validation";
import { parseOptionalYamlConfig } from "./yaml-config";

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

  const requiredFieldsSchema = z
    .object({
      repo_url: z.string().nullable(),
      verbose: z.boolean(),
      dry_run: z.boolean(),
    })
    .superRefine(({ repo_url, dry_run, verbose }, ctx) => {
      if (requiredFields.includes("repo_url") && isNil(repo_url)) {
        ctx.addIssue({
          code: "custom",
          message: "Repository URL is required",
        });
      }
      if (repo_url && !isValidGitUrl(repo_url)) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a valid Git URL (",
        });
      }
    });

  const result = requiredFieldsSchema.safeParse(mergedConfig);

  if (!result.success) {
    throw new Error("problem!!");
  }

  logConfiguration(context, mergedConfig);
  return mergedConfig;
};
