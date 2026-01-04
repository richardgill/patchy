import { FLAG_METADATA, YES_FLAG } from "~/cli-fields";

import type { ParsedFlags } from "~/types/utils";

export const resetFlags = {
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.target_repo.stricliFlag,
  ...FLAG_METADATA.base_revision.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
  ...YES_FLAG,
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
