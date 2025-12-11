import { buildCommand } from "@stricli/core";
import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/types";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const generateCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: {
      ...m.repo_base_dir.stricliFlag,
      ...m.repo_dir.stricliFlag,
      ...m.patches_dir.stricliFlag,
      ...m.repo_url.stricliFlag,
      ...m.ref.stricliFlag,
      ...cm.stricliFlag,
      ...m.verbose.stricliFlag,
      ...m.dry_run.stricliFlag,
    },
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief:
      "Generate .diff files by `git diff`ing repo_dir into the patches directory",
  },
});
