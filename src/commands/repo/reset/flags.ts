import { FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

export const resetFlags = {
  ...FLAG_METADATA.repo_base_dir.stricliFlag,
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
