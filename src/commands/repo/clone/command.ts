import { buildCommand } from "@stricli/core";
import { omit } from "es-toolkit";
import { sharedFlags } from "~/commands/shared-parameters";

const cloneFlags = {
  ...omit(sharedFlags, ["repo-dir", "patches-dir"]),
} as const;

export const cloneCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: cloneFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Clone an upstream repository",
  },
});
