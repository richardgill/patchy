export const sharedFlags = {
  "repo-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to the Git repo being patched",
    optional: true,
  },
  "repo-base-dir": {
    kind: "parsed",
    parse: String,
    brief: "Parent directory where upstream repos are cloned",
    optional: true,
  },
  "patches-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to patch files",
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
