import { buildCommand } from "@stricli/core";
import { sharedFlags } from "../shared-parameters";

const initFlags = {
  ...sharedFlags,
  force: {
    kind: "boolean",
    brief: "Overwrite existing configuration",
    optional: true,
  },
} as const;

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
    brief:
      "Initialize patchy project with directory structure and configuration",
  },
});
