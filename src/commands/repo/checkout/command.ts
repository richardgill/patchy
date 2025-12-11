import { buildCommand } from "@stricli/core";
import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

const checkoutFlags = {
  ...m.repo_dir.stricliFlag,
  ...m.repo_base_dir.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ref: { ...m.ref.stricliFlag.ref, optional: false },
} as const;

export const checkoutCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: checkoutFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Check out a specific Git ref in the repository",
  },
});
