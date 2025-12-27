import { buildCommand } from "@stricli/core";
import { primeFlags } from "./flags";

export const primeCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: primeFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Output AI context for inclusion in CLAUDE.md",
  },
});
