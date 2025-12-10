import {
  PATCHY_CONFIG_ENV_VAR,
  PATCHY_DRY_RUN_ENV_VAR,
  PATCHY_PATCHES_DIR_ENV_VAR,
  PATCHY_REF_ENV_VAR,
  PATCHY_REPO_BASE_DIR_ENV_VAR,
  PATCHY_REPO_DIR_ENV_VAR,
  PATCHY_REPO_URL_ENV_VAR,
  PATCHY_VERBOSE_ENV_VAR,
} from "~/constants";

export const sharedFlags = {
  "repo-base-dir": {
    kind: "parsed",
    parse: String,
    brief: `Parent directory where upstream repos are cloned [env: ${PATCHY_REPO_BASE_DIR_ENV_VAR}]`,
    optional: true,
  },
  "repo-dir": {
    kind: "parsed",
    parse: String,
    brief: `Path to the Git repo being patched [env: ${PATCHY_REPO_DIR_ENV_VAR}]`,
    optional: true,
  },
  "patches-dir": {
    kind: "parsed",
    parse: String,
    brief: `Path to patch files [env: ${PATCHY_PATCHES_DIR_ENV_VAR}]`,
    optional: true,
  },
  "repo-url": {
    kind: "parsed",
    parse: String,
    brief: `The upstream repository URL [env: ${PATCHY_REPO_URL_ENV_VAR}]`,
    optional: true,
  },
  ref: {
    kind: "parsed",
    parse: String,
    brief: `Git ref to use [env: ${PATCHY_REF_ENV_VAR}]`,
    optional: true,
  },
  config: {
    kind: "parsed",
    parse: String,
    brief: `Path for the config file [env: ${PATCHY_CONFIG_ENV_VAR}]`,
    optional: true,
  },
  verbose: {
    kind: "boolean",
    brief: `Enable verbose log output [env: ${PATCHY_VERBOSE_ENV_VAR}]`,
    optional: true,
  },
  "dry-run": {
    kind: "boolean",
    brief: `Simulate the command without writing files [env: ${PATCHY_DRY_RUN_ENV_VAR}]`,
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
