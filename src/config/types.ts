export type SharedFlags = {
  repoDir?: string;
  repoBaseDir?: string;
  patchesDir?: string;
  config?: string;
  verbose?: boolean;
  dryRun?: boolean;
};

export type InitCommandFlags = SharedFlags & {
  repoUrl?: string;
  ref?: string;
  force?: boolean;
};

export type ApplyCommandFlags = SharedFlags;

export type GenerateCommandFlags = SharedFlags;

export type RepoResetCommandFlags = Pick<SharedFlags, "repoDir">;

export type RepoCheckoutCommandFlags = Pick<SharedFlags, "repoDir"> & {
  ref: string;
};

export type RepoCloneCommandFlags = Pick<
  SharedFlags,
  "repoBaseDir" | "config"
> & {
  repoUrl?: string;
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
