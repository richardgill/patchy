import type { FlagMetadataMap, TypeMap } from "./types";

// Derive JSON config keys (configField: true)
export type DeriveJsonConfigKey<M extends FlagMetadataMap> = {
  [K in keyof M]: M[K]["configField"] extends true ? K : never;
}[keyof M] &
  string;

// Derive runtime-only keys (configField: false)
type DeriveRuntimeFlagKey<M extends FlagMetadataMap> = {
  [K in keyof M]: M[K]["configField"] extends false ? K : never;
}[keyof M] &
  string;

// Derive FlagName (union of all CLI flag names like "repo-url", "dry-run")
export type DeriveFlagName<M extends FlagMetadataMap> = {
  [K in keyof M]: keyof M[K]["stricliFlag"];
}[keyof M] &
  string;

// Maps a FlagKey to its corresponding CLI flag name
type DeriveFlagNameFor<
  M extends FlagMetadataMap,
  K extends keyof M,
> = keyof M[K]["stricliFlag"] & string;

// Maps a CLI flag name back to its FlagKey
type DeriveFlagKeyForFlag<
  M extends FlagMetadataMap,
  F extends DeriveFlagName<M>,
> = {
  [K in keyof M]: F extends DeriveFlagNameFor<M, K> ? K : never;
}[keyof M];

// Gets the TypeScript type for a flag based on metadata
type DeriveFlagType<
  M extends FlagMetadataMap,
  F extends DeriveFlagName<M>,
> = TypeMap[M[DeriveFlagKeyForFlag<M, F>]["type"]];

// SharedFlags type (all flags as optional, keyed by CLI flag name)
export type DeriveSharedFlags<M extends FlagMetadataMap> = {
  [F in DeriveFlagName<M>]?: DeriveFlagType<M, F>;
};

// MergedConfig type (all fields, with proper optionality based on defaultValue)
export type DeriveMergedConfig<M extends FlagMetadataMap> = {
  [K in keyof M]: M[K]["defaultValue"] extends undefined
    ? TypeMap[M[K]["type"]] | undefined
    : TypeMap[M[K]["type"]];
};

// Helper to get runtime arrays from metadata
export const deriveJsonConfigKeys = <M extends FlagMetadataMap>(
  metadata: M,
): DeriveJsonConfigKey<M>[] => {
  return (Object.entries(metadata) as [keyof M, M[keyof M]][])
    .filter(([, meta]) => meta.configField)
    .map(([key]) => key) as DeriveJsonConfigKey<M>[];
};

export const deriveRuntimeFlagKeys = <M extends FlagMetadataMap>(
  metadata: M,
): DeriveRuntimeFlagKey<M>[] => {
  return (Object.entries(metadata) as [keyof M, M[keyof M]][])
    .filter(([, meta]) => !meta.configField)
    .map(([key]) => key) as DeriveRuntimeFlagKey<M>[];
};

// Helper to get the CLI flag name from a key
export const getFlagName = <M extends FlagMetadataMap, K extends keyof M>(
  metadata: M,
  key: K,
): DeriveFlagNameFor<M, K> => {
  return Object.keys(metadata[key].stricliFlag)[0] as DeriveFlagNameFor<M, K>;
};

// Helper to get the default value for a key
export const getDefaultValue = <M extends FlagMetadataMap, K extends keyof M>(
  metadata: M,
  key: K,
): TypeMap[M[K]["type"]] | undefined => {
  return metadata[key].defaultValue as TypeMap[M[K]["type"]] | undefined;
};
