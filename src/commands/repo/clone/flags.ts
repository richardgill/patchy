import { FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

const m = FLAG_METADATA;

export const cloneFlags = {
  ...m.repo_url.stricliFlag,
  ...m.repo_base_dir.stricliFlag,
  ...m.ref.stricliFlag,
  ...m.config.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
} as const;

export type CloneFlags = ParsedFlags<typeof cloneFlags>;
