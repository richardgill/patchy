import { buildCommand } from "@stricli/core";
import { pick } from "es-toolkit";
import { sharedFlags } from "~/commands/shared-parameters";

const resetFlags = pick(sharedFlags, [
  "repo-base-dir",
  "repo-dir",
  "config",
  "verbose",
  "dry-run",
]);

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
