import {
  type DeriveJsonConfigKey,
  type DeriveMergedConfig,
  type DeriveSharedFlags,
  deriveJsonConfigKeys,
  getDefaultValue as genericGetDefaultValue,
  type TypeMap,
} from "~/lib/cli-config";
import type { EnrichedFields } from "./enriched-fields";
import { FLAG_METADATA } from "./metadata";

// Core key types
type FlagKey = keyof typeof FLAG_METADATA;
export type JsonConfigKey = DeriveJsonConfigKey<typeof FLAG_METADATA>;

// Runtime array for iterating JSON config keys
export const JSON_CONFIG_KEYS = deriveJsonConfigKeys(FLAG_METADATA);

export const getDefaultValue = <K extends FlagKey>(
  key: K,
): TypeMap[(typeof FLAG_METADATA)[K]["type"]] | undefined =>
  genericGetDefaultValue(FLAG_METADATA, key) as
    | TypeMap[(typeof FLAG_METADATA)[K]["type"]]
    | undefined;

// Shared flags type (for CLI flag parsing)
export type SharedFlags = DeriveSharedFlags<typeof FLAG_METADATA>;

// Merged config includes JSON config + runtime flags
export type MergedConfig = DeriveMergedConfig<typeof FLAG_METADATA>;

// Enriched config with computed absolute paths
export type EnrichedMergedConfig = MergedConfig & EnrichedFields;
