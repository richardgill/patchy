import { writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createEnrichedMergedConfig } from "~/config/resolver";
import type { LocalContext } from "~/context";
import { ensureDirExists } from "~/lib/fs";
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

export default async function (
  this: LocalContext,
  flags: GenerateFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: ["repo_base_dir", "repo_dir"],
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
    return;
  }

  const operations = toPatchToGenerates(
    changes,
    absoluteRepoDir,
    absolutePatchesDir,
  );

  if (config.dry_run) {
    this.process.stdout.write(
      `[DRY RUN] Would generate patches from ${config.repo_dir} to ${config.patches_dir}\n`,
    );
    this.process.stdout.write(`Found ${operations.length} change(s):\n`);
    for (const op of operations) {
      this.process.stdout.write(
        `  ${op.type}: ${op.relativePath} -> ${op.destPath}\n`,
      );
    }
    return;
  }

  this.process.stdout.write(
    `Generating patches from ${config.repo_dir} to ${config.patches_dir}...\n`,
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

  this.process.stdout.write(
    `Generated ${operations.length} patch(es) successfully.\n`,
  );
}
