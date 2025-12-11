import { buildCommand } from "@stricli/core";
import { cloneFlags } from "./flags";

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
