import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isNil } from "es-toolkit";
import type { ZodError, ZodSchema } from "zod";
import { parseJsonc } from "~/lib/jsonc";
import { type ConfigSources, createMergedConfig } from "./resolver";
import type {
  DeriveJsonConfigKey,
  DeriveMergedConfig,
  DeriveSharedFlags,
} from "./type-derivations";
import type { FlagMetadataMap } from "./types";

type LoadConfigParams<
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = {
  metadata: M;
  flags: DeriveSharedFlags<M>;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  defaultConfigPath: string;
  configFlagKey: keyof M; // Key in metadata for the config flag (e.g., "config")
  schema: ZodSchema<TJson>;
  formatZodError?: (error: ZodError) => string;
};

type LoadConfigSuccess<
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = {
  success: true;
  mergedConfig: DeriveMergedConfig<M>;
  configPath: string;
  sources: ConfigSources<M, TJson>;
};

type LoadConfigResult<
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
> = LoadConfigSuccess<M, TJson> | { success: false; error: string };

export const loadConfigFromFile = <
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
>({
  metadata,
  flags,
  cwd,
  env = process.env,
  defaultConfigPath,
  configFlagKey,
  schema,
  formatZodError = (e) => e.message,
}: LoadConfigParams<M, TJson>): LoadConfigResult<M, TJson> => {
  // Get config path from flag → env → default
  const configMeta = metadata[configFlagKey];
  const flagName = Object.keys(configMeta.stricliFlag)[0];
  const configPath =
    ((flags as Record<string, unknown>)[flagName] as string | undefined) ??
    env[configMeta.env] ??
    defaultConfigPath;

  const configExplicitlySet =
    (flags as Record<string, unknown>)[flagName] !== undefined ||
    env[configMeta.env] !== undefined;

  const absoluteConfigPath = resolve(cwd, configPath);

  // Check file existence
  if (!existsSync(absoluteConfigPath) && configExplicitlySet) {
    return {
      success: false,
      error: `Configuration file not found: ${absoluteConfigPath}`,
    };
  }

  // Read and parse file
  let jsonString: string | undefined;
  if (existsSync(absoluteConfigPath)) {
    jsonString = readFileSync(absoluteConfigPath, "utf8");
  }

  // Parse JSONC
  if (isNil(jsonString)) {
    // No config file, use empty object
    const { mergedConfig, sources } = createMergedConfig({
      metadata,
      flags,
      env,
      json: {} as TJson,
    });
    return { success: true, mergedConfig, configPath, sources };
  }

  const parseResult = parseJsonc<unknown>(jsonString);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  // Validate with Zod schema
  const zodResult = schema.safeParse(parseResult.json);
  if (!zodResult.success) {
    return { success: false, error: formatZodError(zodResult.error) };
  }

  // Create merged config
  const { mergedConfig, sources } = createMergedConfig({
    metadata,
    flags,
    env,
    json: zodResult.data,
  });

  return { success: true, mergedConfig, configPath, sources };
};
