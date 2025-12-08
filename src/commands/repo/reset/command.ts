import { buildCommand } from "@stricli/core";
import { pick } from "es-toolkit";
import { sharedFlags } from "~/commands/shared-parameters";

const resetFlags = {
  ...pick(sharedFlags, ["repo-base-dir", "repo-dir", "config", "verbose"]),
  yes: {
    kind: "boolean",
    brief: "Skip confirmation prompt",
    optional: true,
  },
} as const;

export const resetCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: resetFlags,
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Hard reset the Git working tree of repo_dir",
  },
});
