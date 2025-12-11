import type { SnakeToCamel } from "~/types/utils";

// CONFIG_FIELD_METADATA is the single source of truth for config field definitions
export const CONFIG_FIELD_METADATA = {
  repo_url: {
    env: "PATCHY_REPO_URL",
    type: "string",
    name: "Repository URL",
    example: "https://github.com/user/repo.git",
    stricliFlag: {
      "repo-url": {
        kind: "parsed",
        parse: String,
        brief: "The upstream repository URL [env: PATCHY_REPO_URL]",
        optional: true,
      },
    },
  },
  repo_dir: {
    env: "PATCHY_REPO_DIR",
    type: "string",
    name: "Repository directory",
    example: "./repo",
    stricliFlag: {
      "repo-dir": {
        kind: "parsed",
        parse: String,
        brief: "Path to the Git repo being patched [env: PATCHY_REPO_DIR]",
        optional: true,
      },
    },
  },
  repo_base_dir: {
    env: "PATCHY_REPO_BASE_DIR",
    type: "string",
    name: "Repository base directory",
    example: "./upstream",
    stricliFlag: {
      "repo-base-dir": {
        kind: "parsed",
        parse: String,
        brief:
          "Parent directory where upstream repos are cloned [env: PATCHY_REPO_BASE_DIR]",
        optional: true,
      },
    },
  },
  patches_dir: {
    env: "PATCHY_PATCHES_DIR",
    type: "string",
    name: "Patches directory",
    example: "./patches",
    stricliFlag: {
      "patches-dir": {
        kind: "parsed",
        parse: String,
        brief: "Path to patch files [env: PATCHY_PATCHES_DIR]",
        optional: true,
      },
    },
  },
  ref: {
    env: "PATCHY_REF",
    type: "string",
    name: "Git reference",
    example: "main",
    stricliFlag: {
      ref: {
        kind: "parsed",
        parse: String,
        brief: "Git ref to use [env: PATCHY_REF]",
        optional: true,
      },
    },
  },
  verbose: {
    env: "PATCHY_VERBOSE",
    type: "boolean",
    name: "Verbose output",
    example: "true",
    stricliFlag: {
      verbose: {
        kind: "boolean",
        brief: "Enable verbose log output [env: PATCHY_VERBOSE]",
        optional: true,
      },
    },
  },
  dry_run: {
    env: "PATCHY_DRY_RUN",
    type: "boolean",
    name: "Dry run mode",
    example: "true",
    stricliFlag: {
      "dry-run": {
        kind: "boolean",
        brief:
          "Simulate the command without writing files [env: PATCHY_DRY_RUN]",
        optional: true,
      },
    },
  },
} as const;

// CONFIG_FLAG_METADATA for flags not in JSON config (e.g., config file path)
export const CONFIG_FLAG_METADATA = {
  env: "PATCHY_CONFIG",
  type: "string",
  stricliFlag: {
    config: {
      kind: "parsed",
      parse: String,
      brief: "Path for the config file [env: PATCHY_CONFIG]",
      optional: true,
    },
  },
} as const;

// Derived types from CONFIG_FIELD_METADATA
export type JsonKey = keyof typeof CONFIG_FIELD_METADATA;

// FlagName is the union of all flag keys (e.g., "repo-url", "dry-run", etc.)
// We use a mapped type to extract each flag key, then index to get the union
type FlagName = {
  [K in JsonKey]: keyof (typeof CONFIG_FIELD_METADATA)[K]["stricliFlag"];
}[JsonKey];

type ConfigFlagName = keyof (typeof CONFIG_FLAG_METADATA)["stricliFlag"];

// Helper to get the flag name (kebab-case) from a JSON key (snake_case)
export const getFlagName = <K extends JsonKey>(jsonKey: K): FlagName => {
  const metadata = CONFIG_FIELD_METADATA[jsonKey];
  return Object.keys(metadata.stricliFlag)[0] as FlagName;
};

export type SharedFlags = {
  [K in FlagName]?: K extends "verbose" | "dry-run" ? boolean : string;
} & {
  [K in ConfigFlagName]?: string;
};

export type CompleteJsonConfig = {
  [K in JsonKey]: (typeof CONFIG_FIELD_METADATA)[K]["type"] extends "boolean"
    ? boolean
    : string;
};

export type ResolvedConfig = CompleteJsonConfig & {
  absoluteRepoBaseDir: string;
  absoluteRepoDir: string;
  absolutePatchesDir: string;
};

export type CamelCaseResolvedConfig = {
  [K in JsonKey as SnakeToCamel<K>]: CompleteJsonConfig[K];
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
export type PartialCamelCaseResolvedConfig = Partial<CamelCaseResolvedConfig>;
