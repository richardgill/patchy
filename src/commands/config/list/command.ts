import { buildCommand } from "@stricli/core";
import { configListFlags } from "./flags";

export const configListCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: configListFlags,
  },
  docs: {
    brief: "List all config values",
  },
});
