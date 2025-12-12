import type { CamelCase } from "ts-essentials";

// Stricli flag types
type StricliFlagParsed = {
  kind: "parsed";
  parse: StringConstructor;
  brief: string;
  optional: true;
};

type StricliFlagBoolean = {
  kind: "boolean";
  brief: string;
  optional: true;
};

type StricliFlag = StricliFlagParsed | StricliFlagBoolean;

// Base properties shared by all flag metadata entries
type BaseFlagMetadataEntry = {
  env: `PATCHY_${string}`;
  type: "string" | "boolean";
  name: string;
  stricliFlag: Record<string, StricliFlag>;
  example: string;
  defaultValue: string | boolean | undefined;
};

// Entry for flags that appear in the config file
type ConfigFieldEntry = BaseFlagMetadataEntry & {
  configField: true;
  requiredInConfig: boolean;
};

// Entry for runtime-only flags (not in config file)
type RuntimeFieldEntry = BaseFlagMetadataEntry & {
  configField: false;
};

type FlagMetadataEntry = ConfigFieldEntry | RuntimeFieldEntry;

type FlagMetadataMap = Record<string, FlagMetadataEntry>;

// FLAG_METADATA is the single source of truth for all flag/config definitions
export const FLAG_METADATA = {
  repo_url: {
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_REPO_URL",
    type: "string",
    name: "Repository URL",
    example: "https://github.com/user/repo.git",
    defaultValue: undefined,
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
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_REPO_DIR",
    type: "string",
    name: "Repository directory",
    example: "./repo",
    defaultValue: undefined,
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
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_REPO_BASE_DIR",
    type: "string",
    name: "Repository base directory",
    example: "./upstream",
    defaultValue: undefined,
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
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_PATCHES_DIR",
    type: "string",
    name: "Patches directory",
    example: "./patches",
    defaultValue: "./patches/",
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
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_REF",
    type: "string",
    name: "Git reference",
    example: "main",
    defaultValue: "main",
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
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_VERBOSE",
    type: "boolean",
    name: "Verbose output",
    example: "true",
    defaultValue: false,
    stricliFlag: {
      verbose: {
        kind: "boolean",
        brief: "Enable verbose log output [env: PATCHY_VERBOSE]",
        optional: true,
      },
    },
  },
  dry_run: {
    configField: false,
    env: "PATCHY_DRY_RUN",
    type: "boolean",
    name: "Dry run mode",
    example: "true/false",
    defaultValue: false,
    stricliFlag: {
      "dry-run": {
        kind: "boolean",
        brief:
          "Simulate the command without writing files [env: PATCHY_DRY_RUN]",
        optional: true,
      },
    },
  },
  config: {
    configField: false,
    env: "PATCHY_CONFIG",
    type: "string",
    name: "Config file path",
    example: "./patches/",
    defaultValue: "./patches/",
    stricliFlag: {
      config: {
        kind: "parsed",
        parse: String,
        brief: "Path for the config file [env: PATCHY_CONFIG]",
        optional: true,
      },
    },
  },
} as const satisfies FlagMetadataMap;

export type FlagKey = keyof typeof FLAG_METADATA;

// JSON config keys (configField: true)
export type JsonConfigKey = {
  [K in FlagKey]: (typeof FLAG_METADATA)[K]["configField"] extends true
    ? K
    : never;
}[FlagKey];

type RuntimeFlagKeys = {
  [K in FlagKey]: (typeof FLAG_METADATA)[K]["configField"] extends false
    ? K
    : never;
}[FlagKey];

// Runtime-only keys derived at runtime
export const JSON_CONFIG_KEYS = (
  Object.entries(FLAG_METADATA) as [FlagKey, (typeof FLAG_METADATA)[FlagKey]][]
)
  .filter(([, meta]) => meta.configField)
  .map(([key]) => key) as JsonConfigKey[];

export const RUNTIME_FLAG_KEYS = (
  Object.entries(FLAG_METADATA) as [FlagKey, (typeof FLAG_METADATA)[FlagKey]][]
)
  .filter(([, meta]) => !meta.configField)
  .map(([key]) => key) as RuntimeFlagKeys[];

// Maps type string literals to actual TypeScript types
type TypeMap = {
  string: string;
  boolean: boolean;
};

// FlagName is the union of all flag keys (e.g., "repo-url", "dry-run", etc.)
type FlagName = {
  [K in FlagKey]: keyof (typeof FLAG_METADATA)[K]["stricliFlag"];
}[FlagKey];

// Maps a FlagKey to its corresponding CLI flag name
type FlagNameFor<K extends FlagKey> =
  keyof (typeof FLAG_METADATA)[K]["stricliFlag"];

// Maps a CLI flag name back to its FlagKey
type FlagKeyForFlag<F extends FlagName> = {
  [K in FlagKey]: F extends FlagNameFor<K> ? K : never;
}[FlagKey];

// Gets the TypeScript type for a flag based on metadata
type FlagType<F extends FlagName> =
  TypeMap[(typeof FLAG_METADATA)[FlagKeyForFlag<F>]["type"]];

// Helper to get the CLI flag name (kebab-case) from a key (snake_case)
export const getFlagName = <K extends FlagKey>(key: K): FlagName => {
  const metadata = FLAG_METADATA[key];
  return Object.keys(metadata.stricliFlag)[0] as FlagName;
};

// Keys that have default values defined
type KeysWithDefaults = {
  [K in FlagKey]: "defaultValue" extends keyof (typeof FLAG_METADATA)[K]
    ? K
    : never;
}[FlagKey];

// Helper to get the default value for a key (only for keys with defaults)
export const getDefaultValue = <K extends KeysWithDefaults>(
  key: K,
): TypeMap[(typeof FLAG_METADATA)[K]["type"]] => {
  const metadata = FLAG_METADATA[key];
  return metadata.defaultValue as TypeMap[(typeof FLAG_METADATA)[K]["type"]];
};

export type SharedFlags = {
  [K in FlagName]?: FlagType<K>;
};

// JSON config types (only configField: true keys)
export type CompleteJsonConfig = {
  [K in JsonConfigKey]: TypeMap[(typeof FLAG_METADATA)[K]["type"]];
};

// Merged config includes JSON config + runtime flags
export type MergedConfig = {
  [K in FlagKey]: (typeof FLAG_METADATA)[K]["defaultValue"] extends undefined
    ? TypeMap[(typeof FLAG_METADATA)[K]["type"]] | undefined
    : TypeMap[(typeof FLAG_METADATA)[K]["type"]];
};

export type EnrichedMergedConfig = MergedConfig & {
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
  absolutePatchesDir: string | undefined;
};

export type ResolvedConfig = CompleteJsonConfig & {
  absoluteRepoBaseDir: string;
  absoluteRepoDir: string;
  absolutePatchesDir: string;
};

export type CamelCaseResolvedConfig = {
  [K in JsonConfigKey as CamelCase<K>]: CompleteJsonConfig[K];
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
export type PartialCamelCaseResolvedConfig = Partial<CamelCaseResolvedConfig>;
