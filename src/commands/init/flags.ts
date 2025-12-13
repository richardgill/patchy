import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const initFlags = {
  ...FLAG_METADATA.clones_dir.stricliFlag,
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
  gitignore: {
    kind: "boolean",
    brief: "Add clones directory to .gitignore",
    optional: true,
  },
} as const;

export type InitFlags = ParsedFlags<typeof initFlags>;
