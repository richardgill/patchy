import { FLAG_METADATA } from "~/cli-fields";
import { COMMAND_FLAGS } from "~/lib/flags";
import type { ParsedFlags } from "~/types/utils";

export const resetFlags = {
  ...FLAG_METADATA.repo_base_dir.stricliFlag,
  ...FLAG_METADATA.repo_dir.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
  ...COMMAND_FLAGS.yes.stricliFlag,
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
