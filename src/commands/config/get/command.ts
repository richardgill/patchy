import { buildCommand } from "@stricli/core";
import { configGetFlags } from "./flags";

export const configGetCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: configGetFlags,
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Config key to retrieve",
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: "Get a config value by key",
  },
});
