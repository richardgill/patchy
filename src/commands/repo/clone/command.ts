import { buildCommand } from "@stricli/core";
import { pick } from "es-toolkit";
import { sharedFlags } from "~/commands/shared-parameters";

const cloneFlags = {
  ...pick(sharedFlags, [
    "repo-url",
    "repo-base-dir",
    "ref",
    "config",
    "verbose",
    "dry-run",
  ]),
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
