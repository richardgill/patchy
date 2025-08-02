export const sharedFlags = {
  "repo-base-dir": {
    kind: "parsed",
    parse: String,
    brief: "Parent directory where upstream repos are cloned",
    optional: true,
  },
  "repo-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to the Git repo being patched",
    optional: true,
  },
  "patches-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to patch files",
    optional: true,
  },
  "repo-url": {
    kind: "parsed",
    parse: String,
    brief: "The upstream repository URL",
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
  verbose: {
    kind: "boolean",
    brief: "Enable verbose log output",
    optional: true,
  },
  "dry-run": {
    kind: "boolean",
    brief: "Simulate the command without writing files",
    optional: true,
  },
} as const;
