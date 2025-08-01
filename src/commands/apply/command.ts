import { buildCommand } from "@stricli/core";

export const applyCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: {},
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Apply patches to the upstream repository",
  },
});
