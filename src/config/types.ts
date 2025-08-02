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

// Note: underscore_case property names match YAML config keys
export type ResolvedConfig = {
  repo_url: string;
  repo_dir: string;
  repo_base_dir: string;
  patches_dir: string;
  ref: string;
  verbose: boolean;
  dry_run: boolean;
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
    name: "Repository URL",
    example: "https://github.com/user/repo.git",
  },
  repo_dir: {
    flag: "repo-dir",
    name: "Repository directory",
    example: "./repo",
  },
  repo_base_dir: {
    flag: "repo-base-dir",
    name: "Repository base directory",
    example: "./upstream",
  },
  patches_dir: {
    flag: "patches-dir",
    name: "Patches directory",
    example: "./patches",
  },
  ref: {
    flag: "ref",
    name: "Git reference",
    example: "main",
  },
  verbose: {
    flag: "verbose",
    name: "Verbose output",
    example: "true",
  },
  dry_run: {
    flag: "dry-run",
    name: "Dry run mode",
    example: "true",
  },
} as const satisfies Record<
  keyof ResolvedConfig,
  {
    flag: keyof SharedFlags;
    name: string;
    example: string;
  }
>;
