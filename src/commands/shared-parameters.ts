export const sharedFlags = {
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
  dryRun: {
    kind: "boolean",
    brief: "Simulate the command without writing files",
    optional: true,
  },
} as const;
