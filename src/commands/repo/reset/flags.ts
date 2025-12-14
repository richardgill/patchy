import { FLAG_METADATA } from "~/cli-fields";

import type { ParsedFlags } from "~/types/utils";

export const resetFlags = {
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.repo_dir.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
  yes: {
    kind: "boolean",
    brief: "Skip confirmation prompts",
    optional: true,
  },
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
