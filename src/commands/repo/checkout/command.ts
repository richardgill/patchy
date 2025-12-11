import { buildCommand } from "@stricli/core";
import { checkoutFlags } from "./flags";

export const checkoutCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: checkoutFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Check out a specific Git ref in the repository",
  },
});
