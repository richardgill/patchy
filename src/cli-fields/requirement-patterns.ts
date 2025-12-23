import { compact } from "es-toolkit";
import { hasAbsoluteTargetRepo } from "./has-absolute-target-repo";
import type {
  EnrichedMergedConfig,
  JsonConfigKey,
  MergedConfig,
} from "./types";

export type RequirementPattern<G extends keyof EnrichedMergedConfig> = {
  readonly validate:
    | readonly JsonConfigKey[]
    | ((config: MergedConfig) => JsonConfigKey[]);
  readonly guarantees: readonly G[];
};

export const REQUIRE_TARGET_REPO: RequirementPattern<
  "target_repo" | "absoluteTargetRepo"
> = {
  validate: (config) =>
    compact([!hasAbsoluteTargetRepo(config) && "clones_dir", "target_repo"]),
  guarantees: ["target_repo", "absoluteTargetRepo"],
};

export const REQUIRE_PATCHES_DIR: RequirementPattern<
  "patches_dir" | "absolutePatchesDir"
> = {
  validate: ["patches_dir"],
  guarantees: ["patches_dir", "absolutePatchesDir"],
};

export const REQUIRE_SOURCE_REPO: RequirementPattern<"source_repo"> = {
  validate: ["source_repo"],
  guarantees: ["source_repo"],
};

export const REQUIRE_BASE_REVISION: RequirementPattern<"base_revision"> = {
  validate: ["base_revision"],
  guarantees: ["base_revision"],
};
