import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/metadata";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const resetFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  yes: {
    kind: "boolean",
    brief: "Skip confirmation prompts",
    optional: true,
  },
} as const;

export type ResetFlags = ParsedFlags<typeof resetFlags>;
