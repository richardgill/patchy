import { writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LocalContext } from "~/context";
import {
  ensureDirExists,
  formatPathForDisplay,
  toRelativeDisplayPath,
} from "~/lib/fs";
import { getHookFilenames } from "~/lib/hooks";
import { cleanupStalePatches } from "./cleanup";
import { loadAndValidateConfig } from "./config";
import type { GenerateFlags } from "./flags";
import { generateDiff, getGitChanges } from "./git-changes";
import { printDryRun, reportSuccess } from "./output";
import { getExpectedPatchPaths, toPatchOperations } from "./patch-operations";
import { CREATE_NEW_OPTION, resolvePatchSet } from "./patch-set-prompt";

export { CREATE_NEW_OPTION };

export default async function (
  this: LocalContext,
  flags: GenerateFlags,
): Promise<void> {
  const config = loadAndValidateConfig(this, flags);
  const { absoluteTargetRepo, absolutePatchesDir } = config;

  const patchSet = await resolvePatchSet(
    this,
    absolutePatchesDir,
    config.patch_set,
  );
  if (!patchSet) return;

  const absolutePatchSetDir = join(absolutePatchesDir, patchSet);
  const changes = await getGitChanges(absoluteTargetRepo);

  const hookPrefix = config.hook_prefix ?? "patchy-";
  const hookFilenames = getHookFilenames(hookPrefix);

  if (changes.length === 0) {
    this.process.stdout.write("No changes detected in repository.\n");
    await cleanupStalePatches({
      context: this,
      patchSetDir: absolutePatchSetDir,
      expectedPaths: new Set(),
      exclude: hookFilenames,
    });
    return;
  }

  const operations = toPatchOperations(
    changes,
    absoluteTargetRepo,
    absolutePatchSetDir,
  );

  if (config.dry_run) {
    await printDryRun({
      context: this,
      config,
      patchSet,
      operations,
      absolutePatchSetDir,
    });
    return;
  }

  this.process.stdout.write(
    `Generating patches from ${toRelativeDisplayPath(config.absoluteTargetRepo, this.cwd)} to ${formatPathForDisplay(config.patches_dir)}/${patchSet}/...\n`,
  );

  ensureDirExists(absolutePatchSetDir);

  for (const op of operations) {
    ensureDirExists(dirname(op.destPath));

    if (op.type === "diff") {
      const diff = await generateDiff(absoluteTargetRepo, op.relativePath);
      writeFileSync(op.destPath, diff);
      this.process.stdout.write(`  Created diff: ${op.relativePath}.diff\n`);
    } else {
      await copyFile(op.sourcePath, op.destPath);
      this.process.stdout.write(`  Copied new file: ${op.relativePath}\n`);
    }
  }

  const expectedPaths = getExpectedPatchPaths(operations);
  const staleCount = await cleanupStalePatches({
    context: this,
    patchSetDir: absolutePatchSetDir,
    expectedPaths,
    exclude: hookFilenames,
  });

  reportSuccess({
    context: this,
    operationCount: operations.length,
    staleCount,
  });
}
