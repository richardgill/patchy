import { writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compact } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { ensureDirExists, formatPathForDisplay, removeFile } from "~/lib/fs";
import type { GenerateFlags } from "./flags";
import { generateDiff, getGitChanges } from "./git-changes";
import {
  getExpectedPatchPaths,
  getStalePatches,
  toPatchOperations,
} from "./patch-operations";
import { CREATE_NEW_OPTION, resolvePatchSet } from "./patch-set-prompt";

export { CREATE_NEW_OPTION };

export default async function (
  this: LocalContext,
  flags: GenerateFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([!hasAbsoluteTargetRepo(config) && "clones_dir", "target_repo"]),
    cwd: this.cwd,
    env: this.process.env,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const absoluteTargetRepo = config.absoluteTargetRepo ?? "";
  const absolutePatchesDir = config.absolutePatchesDir ?? "";

  const patchSet = await resolvePatchSet(
    this,
    absolutePatchesDir,
    config.patch_set,
  );
  if (!patchSet) return;

  const absolutePatchSetDir = join(absolutePatchesDir, patchSet);
  const changes = await getGitChanges(absoluteTargetRepo);

  if (changes.length === 0) {
    this.process.stdout.write("No changes detected in repository.\n");
    await cleanupStalePatches(this, absolutePatchSetDir, new Set());
    return;
  }

  const operations = toPatchOperations(
    changes,
    absoluteTargetRepo,
    absolutePatchSetDir,
  );

  if (config.dry_run) {
    await printDryRun(this, config, patchSet, operations, absolutePatchSetDir);
    return;
  }

  this.process.stdout.write(
    `Generating patches from ${formatPathForDisplay(config.target_repo ?? "")} to ${formatPathForDisplay(config.patches_dir ?? "")}/${patchSet}/...\n`,
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
  const staleCount = await cleanupStalePatches(
    this,
    absolutePatchSetDir,
    expectedPaths,
  );

  const removedMsg = staleCount > 0 ? `, removed ${staleCount} stale` : "";
  this.process.stdout.write(
    `Generated ${operations.length} patch(es)${removedMsg} successfully.\n`,
  );
}

const cleanupStalePatches = async (
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

const printDryRun = async (
  context: LocalContext,
  config: { target_repo?: string; patches_dir?: string },
  patchSet: string,
  operations: Array<{ type: string; relativePath: string; destPath: string }>,
  absolutePatchSetDir: string,
): Promise<void> => {
  context.process.stdout.write(
    `[DRY RUN] Would generate patches from ${formatPathForDisplay(config.target_repo ?? "")} to ${formatPathForDisplay(config.patches_dir ?? "")}/${patchSet}/\n`,
  );
  context.process.stdout.write(`Found ${operations.length} change(s):\n`);
  for (const op of operations) {
    context.process.stdout.write(
      `  ${op.type}: ${op.relativePath} -> ${op.destPath}\n`,
    );
  }

  const expectedPaths = getExpectedPatchPaths(operations);
  const stalePatches = await getStalePatches(
    absolutePatchSetDir,
    expectedPaths,
  );
  if (stalePatches.length > 0) {
    context.process.stdout.write(
      `\nWould remove ${stalePatches.length} stale patch(es):\n`,
    );
    for (const stalePath of stalePatches) {
      const relativePath = relative(absolutePatchSetDir, stalePath);
      context.process.stdout.write(`  remove: ${relativePath}\n`);
    }
  }
};
