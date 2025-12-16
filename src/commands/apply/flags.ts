import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const applyFlags = {
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.target_repo.stricliFlag,
  ...FLAG_METADATA.patches_dir.stricliFlag,
  ...FLAG_METADATA.source_repo.stricliFlag,
  ...FLAG_METADATA.ref.stricliFlag,
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
} as const;

export type ApplyFlags = ParsedFlags<typeof applyFlags>;
