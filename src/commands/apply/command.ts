import { buildCommand } from "@stricli/core";
import { sharedFlags } from "~/commands/shared-parameters";

export const applyCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: sharedFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Apply patches to the upstream repository",
  },
});
