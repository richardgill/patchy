import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const initFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...m.patches_dir.stricliFlag,
  ...m.repo_url.stricliFlag,
  ...m.ref.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  force: {
    kind: "boolean",
    brief: "Overwrite existing configuration",
    optional: true,
  },
} as const;

export type InitFlags = ParsedFlags<typeof initFlags>;
