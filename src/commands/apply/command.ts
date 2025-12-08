import { buildCommand } from "@stricli/core";
import { applyFlags } from "~/commands/shared-parameters";

export const applyCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: applyFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Apply patches to the upstream repository",
  },
});
