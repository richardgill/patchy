import type { CamelCase } from "ts-essentials";
import {
  type DeriveFlagName,
  type DeriveJsonConfigKey,
  type DeriveMergedConfig,
  type DeriveRuntimeFlagKey,
  type DeriveSharedFlags,
  deriveJsonConfigKeys,
  deriveRuntimeFlagKeys,
  getDefaultValue as genericGetDefaultValue,
  getFlagName as genericGetFlagName,
  type TypeMap,
} from "~/lib/cli-config";
import type { EnrichedFields } from "./enriched-fields";
import { FLAG_METADATA } from "./metadata";

// Core key types
export type FlagKey = keyof typeof FLAG_METADATA;
export type JsonConfigKey = DeriveJsonConfigKey<typeof FLAG_METADATA>;
export type RuntimeFlagKey = DeriveRuntimeFlagKey<typeof FLAG_METADATA>;
export type FlagName = DeriveFlagName<typeof FLAG_METADATA>;

// Runtime arrays
export const JSON_CONFIG_KEYS = deriveJsonConfigKeys(FLAG_METADATA);
export const RUNTIME_FLAG_KEYS = deriveRuntimeFlagKeys(FLAG_METADATA);

// Helper functions bound to FLAG_METADATA
export const getFlagName = <K extends FlagKey>(key: K): FlagName =>
  genericGetFlagName(FLAG_METADATA, key) as FlagName;

export const getDefaultValue = <K extends FlagKey>(
  key: K,
): TypeMap[(typeof FLAG_METADATA)[K]["type"]] | undefined =>
  genericGetDefaultValue(FLAG_METADATA, key) as
    | TypeMap[(typeof FLAG_METADATA)[K]["type"]]
    | undefined;

// Shared flags type (for CLI flag parsing)
export type SharedFlags = DeriveSharedFlags<typeof FLAG_METADATA>;

// JSON config types (only configField: true keys)
export type CompleteJsonConfig = {
  [K in JsonConfigKey]: TypeMap[(typeof FLAG_METADATA)[K]["type"]];
};

// Merged config includes JSON config + runtime flags
export type MergedConfig = DeriveMergedConfig<typeof FLAG_METADATA>;

// Enriched config with computed absolute paths
export type EnrichedMergedConfig = MergedConfig & EnrichedFields;

// Resolved config (all fields required + absolute paths)
export type ResolvedConfig = CompleteJsonConfig & {
  absoluteRepoBaseDir: string;
  absoluteRepoDir: string;
  absolutePatchesDir: string;
};

export type CamelCaseResolvedConfig = {
  [K in JsonConfigKey as CamelCase<K>]: CompleteJsonConfig[K];
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
export type PartialCamelCaseResolvedConfig = Partial<CamelCaseResolvedConfig>;
