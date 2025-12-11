import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const generateFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...m.patches_dir.stricliFlag,
  ...m.repo_url.stricliFlag,
  ...m.ref.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
} as const;

export type GenerateFlags = ParsedFlags<typeof generateFlags>;
