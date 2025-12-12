import { FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

export const initFlags = {
  ...FLAG_METADATA.repo_base_dir.stricliFlag,
  ...FLAG_METADATA.repo_dir.stricliFlag,
  ...FLAG_METADATA.patches_dir.stricliFlag,
  ...FLAG_METADATA.repo_url.stricliFlag,
  ...FLAG_METADATA.ref.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  force: {
    kind: "boolean",
    brief: "Overwrite existing configuration",
    optional: true,
  },
} as const;

export type InitFlags = ParsedFlags<typeof initFlags>;
