import { buildCommand } from "@stricli/core";
import { generateFlags } from "./flags";

export const generateCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: generateFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief:
      "Generate .diff files by `git diff`ing target_repo into the patches directory",
  },
});
