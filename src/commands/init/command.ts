import { buildCommand } from "@stricli/core";

export const initCommand = buildCommand({
  loader: async () => import("./impl.js"),
  parameters: {
    flags: {},
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Initialize patchy",
  },
});
