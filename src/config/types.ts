import {
  PATCHY_DRY_RUN_ENV_VAR,
  PATCHY_PATCHES_DIR_ENV_VAR,
  PATCHY_REF_ENV_VAR,
  PATCHY_REPO_BASE_DIR_ENV_VAR,
  PATCHY_REPO_DIR_ENV_VAR,
  PATCHY_REPO_URL_ENV_VAR,
  PATCHY_VERBOSE_ENV_VAR,
} from "~/constants";
import type { SnakeToCamel } from "~/types/utils";

export type YesFlag = {
  yes?: boolean;
};

export type SharedFlags = {
  "repo-url"?: string;
  "repo-dir"?: string;
  "repo-base-dir"?: string;
  "patches-dir"?: string;
  ref?: string;
  config?: string;
  verbose?: boolean;
  "dry-run"?: boolean;
};

export type InitCommandFlags = SharedFlags & {
  force?: boolean;
};

export type ApplyCommandFlags = SharedFlags & {
  "fuzz-factor"?: number;
};

export type GenerateCommandFlags = SharedFlags;

export type CheckoutCommandFlags = Pick<
  SharedFlags,
  "repo-dir" | "repo-base-dir" | "config" | "verbose" | "dry-run"
> & {
  ref: string;
};

export type CloneCommandFlags = Pick<
  SharedFlags,
  "repo-url" | "repo-base-dir" | "ref" | "config" | "verbose" | "dry-run"
>;

export type ResetCommandFlags = Pick<
  SharedFlags,
  "repo-base-dir" | "repo-dir" | "config" | "verbose" | "dry-run"
> &
  YesFlag;

// CONFIG_FIELD_METADATA is defined first so types can be derived from it
export const CONFIG_FIELD_METADATA = {
  repo_url: {
    flag: "repo-url",
    env: PATCHY_REPO_URL_ENV_VAR,
    type: "string",
    name: "Repository URL",
    example: "https://github.com/user/repo.git",
  },
  repo_dir: {
    flag: "repo-dir",
    env: PATCHY_REPO_DIR_ENV_VAR,
    type: "string",
    name: "Repository directory",
    example: "./repo",
  },
  repo_base_dir: {
    flag: "repo-base-dir",
    env: PATCHY_REPO_BASE_DIR_ENV_VAR,
    type: "string",
    name: "Repository base directory",
    example: "./upstream",
  },
  patches_dir: {
    flag: "patches-dir",
    env: PATCHY_PATCHES_DIR_ENV_VAR,
    type: "string",
    name: "Patches directory",
    example: "./patches",
  },
  ref: {
    flag: "ref",
    env: PATCHY_REF_ENV_VAR,
    type: "string",
    name: "Git reference",
    example: "main",
  },
  verbose: {
    flag: "verbose",
    env: PATCHY_VERBOSE_ENV_VAR,
    type: "boolean",
    name: "Verbose output",
    example: "true",
  },
  dry_run: {
    flag: "dry-run",
    env: PATCHY_DRY_RUN_ENV_VAR,
    type: "boolean",
    name: "Dry run mode",
    example: "true",
  },
} as const satisfies Record<
  string,
  {
    flag: Exclude<keyof SharedFlags, "config">;
    env: string;
    type: "boolean" | "string";
    name: string;
    example: string;
  }
>;

// Derived types from CONFIG_FIELD_METADATA
export type JsonKey = keyof typeof CONFIG_FIELD_METADATA;

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
