import { buildCommand } from "@stricli/core";
import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

const cloneFlags = {
  ...m.repo_url.stricliFlag,
  ...m.repo_base_dir.stricliFlag,
  ...m.ref.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
} as const;

export const cloneCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: cloneFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Clone an upstream repository",
  },
});
