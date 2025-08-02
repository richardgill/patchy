import { buildCommand } from "@stricli/core";
import { omit } from "es-toolkit";
import { sharedFlags } from "../shared-parameters";

const initFlags = {
  ...omit(sharedFlags, ["dry-run"]),
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
    brief: "Initialize patchy.yml configuration",
  },
});
