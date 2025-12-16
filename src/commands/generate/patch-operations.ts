import { existsSync } from "node:fs";
import { join } from "node:path";
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

export const getStalePatches = async (
  patchSetDir: string,
  expectedPaths: Set<string>,
): Promise<string[]> => {
  if (!existsSync(patchSetDir)) {
    return [];
  }
  const existingPatches = await getAllFiles(patchSetDir);
  return existingPatches
    .map((relativePath) => join(patchSetDir, relativePath))
    .filter((absolutePath) => !expectedPaths.has(absolutePath));
};
