export const sharedFlags = {
  "repo-base-dir": {
    kind: "parsed",
    parse: String,
    brief:
      "Parent directory where upstream repos are cloned [env: PATCHY_REPO_BASE_DIR]",
    optional: true,
  },
  "repo-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to the Git repo being patched [env: PATCHY_REPO_DIR]",
    optional: true,
  },
  "patches-dir": {
    kind: "parsed",
    parse: String,
    brief: "Path to patch files [env: PATCHY_PATCHES_DIR]",
    optional: true,
  },
  "repo-url": {
    kind: "parsed",
    parse: String,
    brief: "The upstream repository URL [env: PATCHY_REPO_URL]",
    optional: true,
  },
  ref: {
    kind: "parsed",
    parse: String,
    brief: "Git ref to use [env: PATCHY_REF]",
    optional: true,
  },
  config: {
    kind: "parsed",
    parse: String,
    brief: "Path for the config file [env: PATCHY_CONFIG]",
    optional: true,
  },
  verbose: {
    kind: "boolean",
    brief: "Enable verbose log output [env: PATCHY_VERBOSE]",
    optional: true,
  },
  "dry-run": {
    kind: "boolean",
    brief: "Simulate the command without writing files [env: PATCHY_DRY_RUN]",
    optional: true,
  },
} as const;

export const applyFlags = {
  ...sharedFlags,
  "fuzz-factor": {
    kind: "parsed",
    parse: Number,
    brief:
      "Fuzz factor for patch application (higher = more lenient) [env: PATCHY_FUZZ_FACTOR]",
    optional: true,
  },
} as const;

export const yesFlag = {
  yes: {
    kind: "boolean",
    brief: "Skip confirmation prompts",
    optional: true,
  },
} as const;
