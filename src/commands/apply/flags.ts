import { FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

export const applyFlags = {
  ...FLAG_METADATA.repo_base_dir.stricliFlag,
  ...FLAG_METADATA.repo_dir.stricliFlag,
  ...FLAG_METADATA.patches_dir.stricliFlag,
  ...FLAG_METADATA.repo_url.stricliFlag,
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
