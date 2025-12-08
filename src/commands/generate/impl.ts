import { writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";
import { resolveConfig } from "~/config/resolver";
import type { GenerateCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";
import { ensureDirExists } from "~/lib/fs";

// Removes GIT_* env vars that can interfere when running inside git hooks or other git processes
const getCleanGitEnv = (): NodeJS.ProcessEnv => {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
};

type GitChange = {
  type: "modified" | "new";
  path: string;
};

type PatchOperation = {
  type: "diff" | "copy";
  sourcePath: string;
  destPath: string;
  relativePath: string;
};

const gitClient = (repoDir: string) =>
  simpleGit({
    baseDir: repoDir,
    binary: "git",
    maxConcurrentProcesses: 6,
  }).env(getCleanGitEnv());

const getGitChanges = async (repoDir: string): Promise<GitChange[]> => {
  const git = gitClient(repoDir);

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
  const git = gitClient(repoDir);
  return git.diff(["HEAD", "--", filePath]);
};

const toPatchOperations = (
  changes: GitChange[],
  repoDir: string,
  patchesDir: string,
): PatchOperation[] =>
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
  flags: GenerateCommandFlags,
): Promise<void> {
  try {
    const config = (await resolveConfig(this, flags, [
      "repo_base_dir",
      "repo_dir",
    ])) as ResolvedConfig;

    const changes = await getGitChanges(config.absoluteRepoDir);

    if (changes.length === 0) {
      this.process.stdout.write("No changes detected in repository.\n");
      return;
    }

    const operations = toPatchOperations(
      changes,
      config.absoluteRepoDir,
      config.absolutePatchesDir,
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

    ensureDirExists(config.absolutePatchesDir);

    for (const op of operations) {
      ensureDirExists(dirname(op.destPath));

      if (op.type === "diff") {
        const diff = await generateDiff(
          config.absoluteRepoDir,
          op.relativePath,
        );
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
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
