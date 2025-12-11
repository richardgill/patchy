import { buildCommand } from "@stricli/core";
import { initFlags } from "./flags";

export const initCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: initFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Initialize patchy.yml configuration",
  },
});
