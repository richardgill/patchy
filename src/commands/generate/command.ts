import { buildCommand } from "@stricli/core";
import { sharedFlags } from "../shared-parameters";

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
      "Analyze diff in the repo_dir and generate .diff files in the configured patches directory",
  },
});
