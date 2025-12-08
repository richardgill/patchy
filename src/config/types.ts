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

export type ApplyCommandFlags = SharedFlags;

export type GenerateCommandFlags = SharedFlags;

// Note: underscore_case property names match JSON config keys
export type CompleteJsonConfig = {
  repo_url: string;
  ref: string;
  repo_base_dir: string;
  repo_dir: string;
  patches_dir: string;
  verbose: boolean;
  dry_run: boolean;
};

export type JsonKey = keyof CompleteJsonConfig;

export type ResolvedConfig = CompleteJsonConfig & {
  absoluteRepoBaseDir: string;
  absoluteRepoDir: string;
  absolutePatchesDir: string;
};

export type CamelCaseResolvedConfig = {
  repoUrl: string;
  repoDir: string;
  repoBaseDir: string;
  patchesDir: string;
  ref: string;
  verbose: boolean;
  dryRun: boolean;
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
export type PartialCamelCaseResolvedConfig = Partial<CamelCaseResolvedConfig>;

export const CONFIG_FIELD_METADATA = {
  repo_url: {
    flag: "repo-url",
    env: "PATCHY_REPO_URL",
    name: "Repository URL",
    example: "https://github.com/user/repo.git",
  },
  repo_dir: {
    flag: "repo-dir",
    env: "PATCHY_REPO_DIR",
    name: "Repository directory",
    example: "./repo",
  },
  repo_base_dir: {
    flag: "repo-base-dir",
    env: "PATCHY_REPO_BASE_DIR",
    name: "Repository base directory",
    example: "./upstream",
  },
  patches_dir: {
    flag: "patches-dir",
    env: "PATCHY_PATCHES_DIR",
    name: "Patches directory",
    example: "./patches",
  },
  ref: {
    flag: "ref",
    env: "PATCHY_REF",
    name: "Git reference",
    example: "main",
  },
  verbose: {
    flag: "verbose",
    env: "PATCHY_VERBOSE",
    name: "Verbose output",
    example: "true",
  },
  dry_run: {
    flag: "dry-run",
    env: "PATCHY_DRY_RUN",
    name: "Dry run mode",
    example: "true",
  },
} as const satisfies Record<
  JsonKey,
  {
    flag: keyof SharedFlags;
    env: string;
    name: string;
    example: string;
  }
>;
