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
      "Generate .diff files and new full files into ./patches/ based on current dirty changes in repo_dir",
  },
});
