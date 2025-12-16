import type { ValidatorFn } from "~/lib/cli-config";
import type { EnrichedFields } from "./enriched-fields";
import { directoryExists, gitUrl, targetRepoExists } from "./validators";

// Extended metadata entry with optional validator
type PatchyFlagMetadataEntry = {
  env: `PATCHY_${string}`;
  type: "string" | "boolean";
  name: string;
  stricliFlag: Record<
    string,
    | {
        kind: "parsed";
        parse: StringConstructor;
        brief: string;
        optional: true;
      }
    | { kind: "boolean"; brief: string; optional: true }
  >;
  example: string;
  defaultValue: string | boolean | undefined;
  validate?: ValidatorFn<EnrichedFields>;
} & ({ configField: true; requiredInConfig: boolean } | { configField: false });

type PatchyFlagMetadataMap = Record<string, PatchyFlagMetadataEntry>;

/**
 * FLAG_METADATA is the single source of truth for all flag/config definitions.
 *
 * Each entry defines:
 * - configField: whether this appears in patchy.json (true) or is runtime-only (false)
 * - env: environment variable name
 * - type: "string" or "boolean"
 * - name: human-readable name for error messages
 * - stricliFlag: CLI flag definition for Stricli
 * - example: example value for documentation
 * - defaultValue: default if not specified anywhere
 * - validate: optional validation function (only for configField: true)
 */
export const FLAG_METADATA = {
  source_repo: {
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_SOURCE_REPO",
    type: "string",
    name: "Source repository",
    example: "https://github.com/user/repo.git",
    defaultValue: undefined,
    validate: gitUrl,
    stricliFlag: {
      "source-repo": {
        kind: "parsed",
        parse: String,
        brief: "Git URL or local path to clone from [env: PATCHY_SOURCE_REPO]",
        optional: true,
      },
    },
  },
  target_repo: {
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_TARGET_REPO",
    type: "string",
    name: "Target repository",
    example: "my-repo",
    defaultValue: undefined,
    validate: targetRepoExists,
    stricliFlag: {
      "target-repo": {
        kind: "parsed",
        parse: String,
        brief: "Path to the Git repo being patched [env: PATCHY_TARGET_REPO]",
        optional: true,
      },
    },
  },
  clones_dir: {
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_CLONES_DIR",
    type: "string",
    name: "Clones directory",
    example: "./clones",
    defaultValue: "./clones/",
    validate: (config, _key) => directoryExists(config, "absoluteClonesDir"),
    stricliFlag: {
      "clones-dir": {
        kind: "parsed",
        parse: String,
        brief:
          "Directory where upstream repos are cloned [env: PATCHY_CLONES_DIR]",
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
    validate: (config, _key) => directoryExists(config, "absolutePatchesDir"),
    stricliFlag: {
      "patches-dir": {
        kind: "parsed",
        parse: String,
        brief: "Path to patch files [env: PATCHY_PATCHES_DIR]",
        optional: true,
      },
    },
  },
  patch_set: {
    configField: true,
    requiredInConfig: false,
    env: "PATCHY_PATCH_SET",
    type: "string",
    name: "Patch set",
    example: "001-security-fixes",
    defaultValue: undefined,
    stricliFlag: {
      "patch-set": {
        kind: "parsed",
        parse: String,
        brief: "Name of the patch set to use [env: PATCHY_PATCH_SET]",
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
    example: "./patchy.json",
    defaultValue: "./patchy.json",
    stricliFlag: {
      config: {
        kind: "parsed",
        parse: String,
        brief: "Path for the config file [env: PATCHY_CONFIG]",
        optional: true,
      },
    },
  },
} as const satisfies PatchyFlagMetadataMap;
