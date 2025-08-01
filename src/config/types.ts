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

export type RepoResetCommandFlags = Pick<SharedFlags, "repo-dir">;

export type RepoCheckoutCommandFlags = Pick<SharedFlags, "repo-dir"> & {
  ref: string;
};

export type RepoCloneCommandFlags = Pick<
  SharedFlags,
  "repo-base-dir" | "config"
> & {
  "repo-url"?: string;
  ref?: string;
};

export type ResolvedConfig = {
  repoUrl: string;
  repoDir: string;
  repoBaseDir: string;
  patchesDir: string;
  ref: string;
  verbose: boolean;
  dryRun: boolean;
};

export type PartialResolvedConfig = Partial<ResolvedConfig>;
