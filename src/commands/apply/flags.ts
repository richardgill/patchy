import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

const autoCommitValues = ["all", "interactive", "skip-last", "off"] as const;
export type AutoCommitMode = (typeof autoCommitValues)[number];

const onConflictValues = ["markers", "error"] as const;
export type OnConflictMode = (typeof onConflictValues)[number];

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
  "auto-commit": {
    kind: "enum",
    values: autoCommitValues,
    default: "interactive",
    brief:
      "Control automatic committing of patch sets (all = commit everything, interactive = prompt on last, skip-last = leave last uncommitted, off = commit nothing)",
    optional: true,
  },
  "on-conflict": {
    kind: "enum",
    values: onConflictValues,
    default: "markers",
    brief:
      "How to handle patches that fail to apply (markers = insert conflict markers, error = fail immediately)",
    optional: true,
  },
} as const;

export type ApplyFlags = ParsedFlags<typeof applyFlags>;
