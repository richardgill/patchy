import { existsSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import {
  ensureDirExists,
  formatPathForDisplay,
  getAllFiles,
  removeFile,
} from "~/lib/fs";
import { createGitClient } from "~/lib/git";
import type { GenerateFlags } from "./flags";

type GitChange = {
  type: "modified" | "new";
  path: string;
};

type PatchToGenerate = {
  type: "diff" | "copy";
  sourcePath: string;
  destPath: string;
  relativePath: string;
};

const getGitChanges = async (repoDir: string): Promise<GitChange[]> => {
  const git = createGitClient(repoDir);

  const diffSummary = await git.diffSummary(["HEAD"]);
  const modifiedFiles: GitChange[] = diffSummary.files.map((file) => ({
    type: "modified",
    path: file.file,
  }));

  const status = await git.status();
  const newFiles: GitChange[] = [...status.not_added, ...status.created].map(
    (file) => ({ type: "new", path: file }),
  );

  return [...modifiedFiles, ...newFiles];
};

const generateDiff = async (
  repoDir: string,
  filePath: string,
): Promise<string> => {
  const git = createGitClient(repoDir);
  return git.diff(["HEAD", "--", filePath]);
};

const toPatchToGenerates = (
  changes: GitChange[],
  repoDir: string,
  patchesDir: string,
): PatchToGenerate[] =>
  changes.map((change) => {
    if (change.type === "modified") {
      return {
        type: "diff",
        sourcePath: join(repoDir, change.path),
        destPath: join(patchesDir, `${change.path}.diff`),
        relativePath: change.path,
      };
    }
    return {
      type: "copy",
      sourcePath: join(repoDir, change.path),
      destPath: join(patchesDir, change.path),
      relativePath: change.path,
    };
  });

const getExpectedPatchPaths = (operations: PatchToGenerate[]): Set<string> =>
  new Set(operations.map((op) => op.destPath));

const getStalePatches = async (
  patchesDir: string,
  expectedPaths: Set<string>,
): Promise<string[]> => {
  if (!existsSync(patchesDir)) {
    return [];
  }
  const existingPatches = await getAllFiles(patchesDir);
  return existingPatches
    .map((relativePath) => join(patchesDir, relativePath))
    .filter((absolutePath) => !expectedPaths.has(absolutePath));
};

export default async function (
  this: LocalContext,
  flags: GenerateFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: ["clones_dir", "repo_dir"],
    cwd: this.cwd,
  });

  if (!result.success) {
    this.process.stderr.write(result.error);
    this.process.exit(1);
    return;
  }

  const config = result.mergedConfig;
  const absoluteRepoDir = config.absoluteRepoDir ?? "";
  const absolutePatchesDir = config.absolutePatchesDir ?? "";

  const changes = await getGitChanges(absoluteRepoDir);

  if (changes.length === 0) {
    this.process.stdout.write("No changes detected in repository.\n");

    const expectedPaths = new Set<string>();
    const stalePatches = await getStalePatches(
      absolutePatchesDir,
      expectedPaths,
    );

    for (const stalePath of stalePatches) {
      removeFile(stalePath);
      const relativePath = stalePath.replace(`${absolutePatchesDir}/`, "");
      this.process.stdout.write(`  Removed stale: ${relativePath}\n`);
    }

    if (stalePatches.length > 0) {
      this.process.stdout.write(
        `Removed ${stalePatches.length} stale patch(es).\n`,
      );
    }
    return;
  }

  const operations = toPatchToGenerates(
    changes,
    absoluteRepoDir,
    absolutePatchesDir,
  );

  if (config.dry_run) {
    this.process.stdout.write(
      `[DRY RUN] Would generate patches from ${formatPathForDisplay(config.repo_dir ?? "")} to ${formatPathForDisplay(config.patches_dir ?? "")}\n`,
    );
    this.process.stdout.write(`Found ${operations.length} change(s):\n`);
    for (const op of operations) {
      this.process.stdout.write(
        `  ${op.type}: ${op.relativePath} -> ${op.destPath}\n`,
      );
    }

    const expectedPaths = getExpectedPatchPaths(operations);
    const stalePatches = await getStalePatches(
      absolutePatchesDir,
      expectedPaths,
    );
    if (stalePatches.length > 0) {
      this.process.stdout.write(
        `\nWould remove ${stalePatches.length} stale patch(es):\n`,
      );
      for (const stalePath of stalePatches) {
        const relativePath = stalePath.replace(`${absolutePatchesDir}/`, "");
        this.process.stdout.write(`  remove: ${relativePath}\n`);
      }
    }
    return;
  }

  this.process.stdout.write(
    `Generating patches from ${formatPathForDisplay(config.repo_dir ?? "")} to ${formatPathForDisplay(config.patches_dir ?? "")}...\n`,
  );

  ensureDirExists(absolutePatchesDir);

  for (const op of operations) {
    ensureDirExists(dirname(op.destPath));

    if (op.type === "diff") {
      const diff = await generateDiff(absoluteRepoDir, op.relativePath);
      writeFileSync(op.destPath, diff);
      this.process.stdout.write(`  Created diff: ${op.relativePath}.diff\n`);
    } else {
      await copyFile(op.sourcePath, op.destPath);
      this.process.stdout.write(`  Copied new file: ${op.relativePath}\n`);
    }
  }

  const expectedPaths = getExpectedPatchPaths(operations);
  const stalePatches = await getStalePatches(absolutePatchesDir, expectedPaths);

  for (const stalePath of stalePatches) {
    removeFile(stalePath);
    const relativePath = stalePath.replace(`${absolutePatchesDir}/`, "");
    this.process.stdout.write(`  Removed stale: ${relativePath}\n`);
  }

  const removedMsg =
    stalePatches.length > 0 ? `, removed ${stalePatches.length} stale` : "";
  this.process.stdout.write(
    `Generated ${operations.length} patch(es)${removedMsg} successfully.\n`,
  );
}
