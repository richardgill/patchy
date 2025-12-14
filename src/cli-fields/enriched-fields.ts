// Base type for computed absolute paths
// This file has no imports from this module to avoid circular dependencies
export type EnrichedFields = {
  absoluteClonesDir: string | undefined;
  absoluteRepoDir: string | undefined;
  absolutePatchesDir: string | undefined;
};
