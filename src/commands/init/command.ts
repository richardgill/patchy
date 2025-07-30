import { buildCommand } from "@stricli/core";

export const initCommand = buildCommand({
  loader: async () => import("./impl"),
  parameters: {
    flags: {
      repoUrl: {
        kind: "parsed",
        parse: String,
        brief: "The upstream repository URL",
        optional: true,
      },
      repoDir: {
        kind: "parsed",
        parse: String,
        brief: "Path to the Git repo being patched",
        optional: true,
      },
      repoBaseDir: {
        kind: "parsed",
        parse: String,
        brief: "Parent directory where upstream repos are cloned",
        optional: true,
      },
      patchesDir: {
        kind: "parsed",
        parse: String,
        brief: "Path to patch files",
        optional: true,
      },
      ref: {
        kind: "parsed",
        parse: String,
        brief: "Git ref to use",
        optional: true,
      },
      config: {
        kind: "parsed",
        parse: String,
        brief: "Path for the config file",
        optional: true,
      },
      force: {
        kind: "boolean",
        brief: "Overwrite existing configuration",
        optional: true,
      },
    },
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief:
      "Initialize patchy project with directory structure and configuration",
  },
});
