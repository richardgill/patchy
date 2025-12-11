import { buildCommand } from "@stricli/core";
import { yesFlag } from "~/commands/shared-parameters";
import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

const resetFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ...yesFlag,
};

export const resetCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: resetFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Hard reset the Git working tree of repo_dir",
  },
});
