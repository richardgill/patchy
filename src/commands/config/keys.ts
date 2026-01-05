import type { EnrichedMergedConfig } from "~/cli-fields/types";
import { unwrapValue } from "~/lib/cli-config";

export const CONFIG_KEYS = [
  // Raw (from JSON config)
  "source_repo",
  "target_repo",
  "clones_dir",
  "patches_dir",
  "patch_set",
  "base_revision",
  "upstream_branch",
  "hook_prefix",
  "verbose",
  // Computed (absolute paths)
  "clones_dir_path",
  "target_repo_path",
  "patches_dir_path",
  "patch_set_path",
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export const COMPUTED_KEY_MAP: Record<string, keyof EnrichedMergedConfig> = {
  clones_dir_path: "absoluteClonesDir",
  target_repo_path: "absoluteTargetRepo",
  patches_dir_path: "absolutePatchesDir",
  patch_set_path: "absolutePatchSetDir",
};

export const getConfigValue = (
  config: EnrichedMergedConfig,
  key: ConfigKey,
): string | undefined => {
  const enrichedKey = COMPUTED_KEY_MAP[key];
  if (enrichedKey) {
    return config[enrichedKey] as string | undefined;
  }
  const rawValue = unwrapValue(config[key as keyof EnrichedMergedConfig]);
  if (rawValue === undefined) return undefined;
  if (typeof rawValue === "boolean") return String(rawValue);
  return rawValue as string;
};
