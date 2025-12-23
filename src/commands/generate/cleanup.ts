import { relative } from "node:path";
import type { LocalContext } from "~/context";
import { removeFile } from "~/lib/fs";
import { getStalePatches } from "./patch-operations";

export const cleanupStalePatches = async (
  context: LocalContext,
  patchSetDir: string,
  expectedPaths: Set<string>,
): Promise<number> => {
  const stalePatches = await getStalePatches(patchSetDir, expectedPaths);

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
