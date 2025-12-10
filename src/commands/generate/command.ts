import { buildCommand } from "@stricli/core";
import { sharedFlags } from "~/commands/shared-parameters";

export const generateCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: sharedFlags,
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
