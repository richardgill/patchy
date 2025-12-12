import { FLAG_METADATA } from "~/config/config";
import { COMMAND_FLAGS } from "~/lib/flags";
import type { ParsedFlags } from "~/types/utils";

const m = FLAG_METADATA;
const cf = COMMAND_FLAGS;

export const resetFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...m.config.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ...cf.yes.stricliFlag,
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
