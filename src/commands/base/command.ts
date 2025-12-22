import { buildCommand } from "@stricli/core";
import { baseFlags } from "./flags";

export const baseCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: baseFlags,
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Base revision (SHA or tag) to set",
          parse: String,
          optional: true,
        },
      ],
    },
  },
  docs: {
    brief: "View or update the base_revision in config",
  },
});
