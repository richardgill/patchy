import { existsSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compact } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import {
  ensureDirExists,
  formatPathForDisplay,
  getAllFiles,
  getSortedFolders,
  removeFile,
} from "~/lib/fs";
import { createGitClient } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
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

export const CREATE_NEW_OPTION = "_create_new";

const getNextPatchSetPrefix = (patchesDir: string): string => {
  const folders = getSortedFolders(patchesDir);
  const maxPrefix = folders.reduce((max, name) => {
    const match = name.match(/^(\d+)-/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return String(maxPrefix + 1).padStart(3, "0");
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

const getExpectedPatchPaths = (operations: PatchToGenerate[]): Set<string> =>
  new Set(operations.map((op) => op.destPath));

const getStalePatches = async (
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

const resolvePatchSet = async (
  context: LocalContext,
  absolutePatchesDir: string,
  configPatchSet: string | undefined,
): Promise<string | undefined> => {
  if (configPatchSet) {
    return configPatchSet;
  }

  const existingPatchSets = getSortedFolders(absolutePatchesDir);

  if (!canPrompt(context)) {
    context.process.stderr.write(
      "No patch set specified. Use --patch-set, PATCHY_PATCH_SET env var, or set patch_set in config.\n",
    );
    context.process.exit(1);
    return undefined;
  }

  const prompts = createPrompts(context);

  if (existingPatchSets.length === 0) {
    const name = await prompts.text({
      message: "New patch set name:",
      placeholder: "e.g., security-fixes",
      validate: (input) => (input?.trim() ? undefined : "Name is required"),
    });
    if (prompts.isCancel(name)) {
      context.process.stderr.write("Operation cancelled\n");
      context.process.exit(1);
      return undefined;
    }
    const prefix = getNextPatchSetPrefix(absolutePatchesDir);
    return `${prefix}-${name}`;
  }

  const options: Array<{ value: string; label: string }> = [
    ...existingPatchSets.map((name) => ({ value: name, label: name })),
    { value: CREATE_NEW_OPTION, label: "Create new patch set" },
  ];

  const selected = await prompts.select({
    message: "Select patch set:",
    options,
  });

  if (prompts.isCancel(selected)) {
    context.process.stderr.write("Operation cancelled\n");
    context.process.exit(1);
    return undefined;
  }

  if (selected === CREATE_NEW_OPTION) {
    const name = await prompts.text({
      message: "New patch set name:",
      placeholder: "e.g., security-fixes",
      validate: (input) => (input?.trim() ? undefined : "Name is required"),
    });
    if (prompts.isCancel(name)) {
      context.process.stderr.write("Operation cancelled\n");
      context.process.exit(1);
      return undefined;
    }
    const prefix = getNextPatchSetPrefix(absolutePatchesDir);
    return `${prefix}-${name}`;
  }

  return selected as string;
};

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

    const expectedPaths = new Set<string>();
    const stalePatches = await getStalePatches(
      absolutePatchSetDir,
      expectedPaths,
    );

    for (const stalePath of stalePatches) {
      removeFile(stalePath);
      const relativePath = relative(absolutePatchSetDir, stalePath);
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
    absoluteTargetRepo,
    absolutePatchSetDir,
  );

  if (config.dry_run) {
    this.process.stdout.write(
      `[DRY RUN] Would generate patches from ${formatPathForDisplay(config.target_repo ?? "")} to ${formatPathForDisplay(config.patches_dir ?? "")}/${patchSet}/\n`,
    );
    this.process.stdout.write(`Found ${operations.length} change(s):\n`);
    for (const op of operations) {
      this.process.stdout.write(
        `  ${op.type}: ${op.relativePath} -> ${op.destPath}\n`,
      );
    }

    const expectedPaths = getExpectedPatchPaths(operations);
    const stalePatches = await getStalePatches(
      absolutePatchSetDir,
      expectedPaths,
    );
    if (stalePatches.length > 0) {
      this.process.stdout.write(
        `\nWould remove ${stalePatches.length} stale patch(es):\n`,
      );
      for (const stalePath of stalePatches) {
        const relativePath = relative(absolutePatchSetDir, stalePath);
        this.process.stdout.write(`  remove: ${relativePath}\n`);
      }
    }
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
  const stalePatches = await getStalePatches(
    absolutePatchSetDir,
    expectedPaths,
  );

  for (const stalePath of stalePatches) {
    removeFile(stalePath);
    const relativePath = relative(absolutePatchSetDir, stalePath);
    this.process.stdout.write(`  Removed stale: ${relativePath}\n`);
  }

  const removedMsg =
    stalePatches.length > 0 ? `, removed ${stalePatches.length} stale` : "";
  this.process.stdout.write(
    `Generated ${operations.length} patch(es)${removedMsg} successfully.\n`,
  );
}
