import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const applyFlags = {
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.target_repo.stricliFlag,
  ...FLAG_METADATA.patches_dir.stricliFlag,
  ...FLAG_METADATA.source_repo.stricliFlag,
  ...FLAG_METADATA.base_revision.stricliFlag,
  ...FLAG_METADATA.hook_prefix.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
  "fuzz-factor": {
    kind: "parsed",
    parse: Number,
    brief:
      "Fuzz factor for patch application (higher = more lenient) [env: PATCHY_FUZZ_FACTOR]",
    optional: true,
  },
  only: {
    kind: "parsed",
    parse: String,
    brief: "Apply only the specified patch set",
    optional: true,
  },
  until: {
    kind: "parsed",
    parse: String,
    brief: "Apply patch sets up to and including the specified one",
    optional: true,
  },
  all: {
    kind: "boolean",
    brief: "Automatically commit all patch sets without prompting",
    optional: true,
  },
  edit: {
    kind: "boolean",
    brief: "Leave the last patch set uncommitted for manual review",
    optional: true,
  },
} as const;

export type ApplyFlags = ParsedFlags<typeof applyFlags>;

export const validateCommitFlags = (
  all: boolean | undefined,
  edit: boolean | undefined,
): { error?: string } => {
  if (all && edit) {
    return { error: "Cannot use both --all and --edit flags together" };
  }
  return {};
};
