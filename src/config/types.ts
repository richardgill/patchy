export type SharedFlags = {
  "repo-dir"?: string;
  "repo-base-dir"?: string;
  "patches-dir"?: string;
  config?: string;
  verbose?: boolean;
  "dry-run"?: boolean;
};

export type InitCommandFlags = SharedFlags & {
  "repo-url"?: string;
  ref?: string;
  force?: boolean;
};

export type ApplyCommandFlags = SharedFlags;

export type GenerateCommandFlags = SharedFlags;

export type ResolvedConfig = {
  repo_url: string;
  repo_dir: string;
  repo_base_dir: string;
  patches_dir: string;
  ref: string;
  verbose: boolean;
  dry_run: boolean;
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
