import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/config";
import { COMMAND_FLAGS } from "~/lib/flags";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;
const cf = COMMAND_FLAGS;

export const resetFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ...cf.yes.stricliFlag,
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
