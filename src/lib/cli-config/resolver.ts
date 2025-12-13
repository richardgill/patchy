import {
  type DeriveFlagName,
  type DeriveJsonConfigKey,
  type DeriveMergedConfig,
  type DeriveSharedFlags,
  deriveJsonConfigKeys,
  deriveRuntimeFlagKeys,
  getFlagName,
} from "./type-derivations";
import type { FlagMetadataMap } from "./types";

export type ConfigSources<
  M extends FlagMetadataMap,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = {
  flags: DeriveSharedFlags<M>;
  env: NodeJS.ProcessEnv;
  json: TJsonConfig;
};

// Get value from env var, converting to appropriate type
const getEnvValue = <M extends FlagMetadataMap>(
  metadata: M,
  key: keyof M,
  env: NodeJS.ProcessEnv,
): unknown => {
  const meta = metadata[key];
  const envValue = env[meta.env];
  if (envValue === undefined || envValue === "") {
    return undefined;
  }
  if (meta.type === "boolean") {
    return envValue.toLowerCase() === "true" || envValue === "1";
  }
  return envValue;
};

// Get value for a JSON config key from flags, env, or JSON (in priority order)
const getValueByKey = <
  M extends FlagMetadataMap,
  K extends DeriveJsonConfigKey<M>,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
>(
  metadata: M,
  key: K,
  sources: ConfigSources<M, TJsonConfig>,
): unknown => {
  const flagName = getFlagName(metadata, key);
  const flagValue = sources.flags[flagName as DeriveFlagName<M>];
  if (flagValue !== undefined) return flagValue;

  const envValue = getEnvValue(metadata, key, sources.env);
  if (envValue !== undefined) return envValue;

  return sources.json[key as keyof TJsonConfig];
};

// Get value for a runtime-only flag from flags or env (no JSON source)
const getRuntimeFlagValue = <M extends FlagMetadataMap>(
  metadata: M,
  key: keyof M,
  flags: DeriveSharedFlags<M>,
  env: NodeJS.ProcessEnv,
): unknown => {
  const meta = metadata[key];
  const flagName = getFlagName(metadata, key);
  const flagValue = flags[flagName as DeriveFlagName<M>];
  if (flagValue !== undefined) return flagValue;

  const envValue = getEnvValue(metadata, key, env);
  if (envValue !== undefined) return envValue;

  return meta.defaultValue;
};

type CreateMergedConfigParams<
  M extends FlagMetadataMap,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = {
  metadata: M;
  flags: DeriveSharedFlags<M>;
  env: NodeJS.ProcessEnv;
  json: TJsonConfig;
};

type MergedConfigResult<
  M extends FlagMetadataMap,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = {
  mergedConfig: DeriveMergedConfig<M>;
  sources: ConfigSources<M, TJsonConfig>;
};

// Generic config merger that handles flag → env → json priority.
// Does not handle file loading or validation - that's left to the caller.
export const createMergedConfig = <
  M extends FlagMetadataMap,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
>({
  metadata,
  flags,
  env,
  json,
}: CreateMergedConfigParams<M, TJsonConfig>): MergedConfigResult<
  M,
  TJsonConfig
> => {
  const jsonConfigKeys = deriveJsonConfigKeys(metadata);
  const runtimeFlagKeys = deriveRuntimeFlagKeys(metadata);

  const sources: ConfigSources<M, TJsonConfig> = { flags, env, json };

  // Build config from JSON config fields
  const jsonConfig = Object.fromEntries(
    jsonConfigKeys.map((key) => {
      const value = getValueByKey(metadata, key, sources);
      const meta = metadata[key];
      return [key, value ?? meta.defaultValue];
    }),
  );

  // Add runtime-only flags
  const runtimeFlags = Object.fromEntries(
    runtimeFlagKeys.map((key) => [
      key,
      getRuntimeFlagValue(metadata, key, flags, env),
    ]),
  );

  const mergedConfig = {
    ...jsonConfig,
    ...runtimeFlags,
  } as DeriveMergedConfig<M>;

  return { mergedConfig, sources };
};

// Get values for a specific key from all sources (for error reporting)
export const getValuesByKey = <
  M extends FlagMetadataMap,
  K extends DeriveJsonConfigKey<M>,
  TJsonConfig extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
>(
  metadata: M,
  key: K,
  sources: ConfigSources<M, TJsonConfig>,
): { flag: unknown; env: unknown; json: unknown } => {
  const flagName = getFlagName(metadata, key);
  return {
    flag: sources.flags[flagName as DeriveFlagName<M>],
    env: getEnvValue(metadata, key, sources.env),
    json: sources.json[key as keyof TJsonConfig],
  };
};
