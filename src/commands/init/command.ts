import { buildCommand } from "@stricli/core";
import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

const initFlags = {
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

export const initCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: initFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Initialize patchy.yml configuration",
  },
});
