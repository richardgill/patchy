import { buildCommand } from "@stricli/core";
import { resetFlags } from "./flags";

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
    brief: "Hard reset the Git working tree of target_repo",
  },
});
