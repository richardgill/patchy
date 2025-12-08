import { buildCommand } from "@stricli/core";
import { pick } from "es-toolkit";
import { sharedFlags } from "~/commands/shared-parameters";

const checkoutFlags = {
  ...pick(sharedFlags, ["repo-dir", "repo-base-dir", "config", "verbose"]),
  ref: {
    kind: "parsed",
    parse: String,
    brief: "Git ref to use [env: PATCHY_REF]",
    optional: false,
  },
} as const;

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
