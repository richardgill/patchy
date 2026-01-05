import { join } from "node:path";
import chalk from "chalk";
import {
  type ConfigSources,
  loadConfigFromFile,
  validateConfig,
} from "~/lib/cli-config";
import { isAbsolutePath, resolvePath } from "~/lib/fs";
import { formatZodErrorHuman } from "~/lib/zod";
import { DEFAULT_CONFIG_PATH } from "./defaults";
import { FLAG_METADATA } from "./metadata";
import type { NarrowedConfig } from "./narrowing";
import type { RequirementPattern } from "./requirement-patterns";
import { type JsonConfig, jsonConfigSchema } from "./schema";
import type {
  EnrichedMergedConfig,
  JsonConfigKey,
  MergedConfig,
  SharedFlags,
} from "./types";

type PatchyConfigSources = ConfigSources<typeof FLAG_METADATA, JsonConfig>;

type CreateEnrichedMergedConfigParams<
  P extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
> = {
  flags: SharedFlags;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  requires: P;
};

type ResolveTargetRepoParams = {
  cwd: string;
  targetRepo: string | undefined;
  clonesDir: string | undefined;
};

const resolveTargetRepo = ({
  cwd,
  targetRepo,
  clonesDir,
}: ResolveTargetRepoParams): string | undefined => {
  if (!targetRepo) return undefined;
  if (isAbsolutePath(targetRepo)) return resolvePath(cwd, targetRepo);
  if (clonesDir) return resolvePath(cwd, join(clonesDir, targetRepo));
  return undefined;
};

// Patchy-specific: compute absolute paths from relative config values
const enrichConfig = (
  config: MergedConfig,
  cwd: string,
): EnrichedMergedConfig => {
  const clonesDir = config.clones_dir.value;
  const targetRepo = config.target_repo.value;
  const patchesDir = config.patches_dir.value;
  const patchSet = config.patch_set.value;

  const absolutePatchesDir = resolvePath(cwd, patchesDir);

  return {
    ...config,
    absoluteClonesDir: resolvePath(cwd, clonesDir),
    absoluteTargetRepo: resolveTargetRepo({ cwd, targetRepo, clonesDir }),
    absolutePatchesDir,
    absolutePatchSetDir: patchSet
      ? join(absolutePatchesDir, patchSet)
      : undefined,
  };
};

// Patchy-specific: "patchy init" hint for error messages
const formatInitHint = (
  configPath: string,
  sources: PatchyConfigSources,
): string => {
  return `${chalk.yellow("You can set up")} ${chalk.blue(
    configPath,
  )} ${chalk.yellow("by running:")}\n  ${chalk.bold(
    `patchy init${
      sources.flags.config ? ` --config ${sources.flags.config}` : ""
    }`,
  )}`;
};

const patternsToRequiredFields = <
  P extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
>(
  patterns: P,
): JsonConfigKey[] | ((config: MergedConfig) => JsonConfigKey[]) => {
  const hasDynamicPattern = patterns.some(
    (p) => typeof p.validate === "function",
  );

  if (!hasDynamicPattern) {
    const staticFields = patterns.flatMap((p) => p.validate as JsonConfigKey[]);
    return [...new Set(staticFields)];
  }

  return (config: MergedConfig) => {
    const allFields = patterns.flatMap((p) =>
      typeof p.validate === "function"
        ? p.validate(config)
        : (p.validate as JsonConfigKey[]),
    );
    return [...new Set(allFields)];
  };
};

export const createEnrichedMergedConfig = <
  P extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
>({
  flags,
  requires,
  cwd,
  env = process.env,
}: CreateEnrichedMergedConfigParams<P>):
  | { mergedConfig: NarrowedConfig<P>; success: true }
  | { success: false; error: string } => {
  const result = loadConfigFromFile({
    metadata: FLAG_METADATA,
    flags,
    cwd,
    env,
    defaultConfigPath: DEFAULT_CONFIG_PATH,
    configFlagKey: "config",
    schema: jsonConfigSchema,
    formatZodError: formatZodErrorHuman,
  });

  if (!result.success) {
    return result;
  }

  // Enrich with absolute paths
  const enrichedConfig = enrichConfig(result.mergedConfig as MergedConfig, cwd);

  const requiredFields = patternsToRequiredFields(requires);
  const validationResult = validateConfig({
    metadata: FLAG_METADATA,
    mergedConfig: enrichedConfig,
    requiredFields,
    configPath: result.configPath,
    sources: result.sources,
    formatInitHint,
  });

  if (!validationResult.success) {
    return validationResult;
  }

  return {
    mergedConfig: enrichedConfig as unknown as NarrowedConfig<P>,
    success: true,
  };
};
