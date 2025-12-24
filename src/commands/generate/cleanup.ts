import { relative } from "node:path";
import type { LocalContext } from "~/context";
import { removeFile } from "~/lib/fs";
import { getStalePatches } from "./patch-operations";

type CleanupStalePatchesParams = {
  context: LocalContext;
  patchSetDir: string;
  expectedPaths: Set<string>;
  exclude?: string[];
};

export const cleanupStalePatches = async (
  params: CleanupStalePatchesParams,
): Promise<number> => {
  const { context, patchSetDir, expectedPaths, exclude = [] } = params;
  const stalePatches = await getStalePatches({
    patchSetDir,
    expectedPaths,
    exclude,
  });

  for (const stalePath of stalePatches) {
    removeFile(stalePath);
    const relativePath = relative(patchSetDir, stalePath);
    context.process.stdout.write(`  Removed stale: ${relativePath}\n`);
  }

  if (stalePatches.length > 0) {
    context.process.stdout.write(
      `Removed ${stalePatches.length} stale patch(es).\n`,
    );
  }

  return stalePatches.length;
};
