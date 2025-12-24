import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { getAllFiles } from "~/lib/fs";
import type { GitChange } from "./git-changes";

type PatchToGenerate = {
  type: "diff" | "copy";
  sourcePath: string;
  destPath: string;
  relativePath: string;
};

export const toPatchOperations = (
  changes: GitChange[],
  repoDir: string,
  patchSetDir: string,
): PatchToGenerate[] =>
  changes.map((change) => {
    if (change.type === "modified") {
      return {
        type: "diff",
        sourcePath: join(repoDir, change.path),
        destPath: join(patchSetDir, `${change.path}.diff`),
        relativePath: change.path,
      };
    }
    return {
      type: "copy",
      sourcePath: join(repoDir, change.path),
      destPath: join(patchSetDir, change.path),
      relativePath: change.path,
    };
  });

export const getExpectedPatchPaths = (
  operations: Array<{ destPath: string }>,
): Set<string> => new Set(operations.map((op) => op.destPath));

type GetStalePatchesParams = {
  patchSetDir: string;
  expectedPaths: Set<string>;
  exclude?: string[];
};

export const getStalePatches = async (
  params: GetStalePatchesParams,
): Promise<string[]> => {
  const { patchSetDir, expectedPaths, exclude = [] } = params;
  if (!existsSync(patchSetDir)) {
    return [];
  }
  const excludeSet = new Set(exclude);
  const existingPatches = await getAllFiles(patchSetDir);
  return existingPatches
    .filter((relativePath) => {
      const filename = basename(relativePath);
      return !excludeSet.has(filename);
    })
    .map((relativePath) => join(patchSetDir, relativePath))
    .filter((absolutePath) => !expectedPaths.has(absolutePath));
};
