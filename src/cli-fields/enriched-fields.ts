// Base type for computed absolute paths
// This file has no imports from this module to avoid circular dependencies
export type EnrichedFields = {
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
  absolutePatchesDir: string | undefined;
  // Allow access to other config fields (e.g., repo_url, repo_dir)
  [key: string]: unknown;
};
