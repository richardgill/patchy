import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const cloneFlags = {
  ...FLAG_METADATA.upstream_url.stricliFlag,
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.ref.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
} as const;

export type CloneFlags = ParsedFlags<typeof cloneFlags>;
