import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";
import { resolveConfig } from "~/config/resolver";
import type { GenerateCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";

const getCleanGitEnv = (): NodeJS.ProcessEnv => {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
};

type GitChange = {
  type: "modified" | "new";
  path: string;
};

const createGit = (repoDir: string) =>
  simpleGit({
    baseDir: repoDir,
    binary: "git",
    maxConcurrentProcesses: 6,
  }).env(getCleanGitEnv());

const getGitChanges = async (repoDir: string): Promise<GitChange[]> => {
  const changes: GitChange[] = [];
  const git = createGit(repoDir);

  const diffSummary = await git.diffSummary(["HEAD"]);
  for (const file of diffSummary.files) {
    changes.push({ type: "modified", path: file.file });
  }

  const status = await git.status();
  for (const file of status.not_added) {
    changes.push({ type: "new", path: file });
  }
  for (const file of status.created) {
    changes.push({ type: "new", path: file });
  }

  return changes;
};

const generateDiff = async (
  repoDir: string,
  filePath: string,
): Promise<string> => {
  const git = createGit(repoDir);
  return git.diff(["HEAD", "--", filePath]);
};

const ensureDir = (dirPath: string): void => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

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

    if (config.dry_run) {
      this.process.stdout.write(
        `[DRY RUN] Would generate patches from ${config.repo_dir} to ${config.patches_dir}\n`,
      );
      this.process.stdout.write(`Found ${changes.length} change(s):\n`);
      for (const change of changes) {
        const patchPath =
          change.type === "modified" ? `${change.path}.diff` : change.path;
        this.process.stdout.write(
          `  ${change.type}: ${change.path} -> ${join(config.patches_dir, patchPath)}\n`,
        );
      }
      return;
    }

    this.process.stdout.write(
      `Generating patches from ${config.repo_dir} to ${config.patches_dir}...\n`,
    );

    ensureDir(config.absolutePatchesDir);

    for (const change of changes) {
      const targetDir = dirname(join(config.absolutePatchesDir, change.path));
      ensureDir(targetDir);

      if (change.type === "modified") {
        const diff = await generateDiff(config.absoluteRepoDir, change.path);
        const patchPath = join(
          config.absolutePatchesDir,
          `${change.path}.diff`,
        );
        writeFileSync(patchPath, diff);
        this.process.stdout.write(`  Created diff: ${change.path}.diff\n`);
      } else {
        const sourcePath = join(config.absoluteRepoDir, change.path);
        const destPath = join(config.absolutePatchesDir, change.path);
        await copyFile(sourcePath, destPath);
        this.process.stdout.write(`  Copied new file: ${change.path}\n`);
      }
    }

    this.process.stdout.write(
      `Generated ${changes.length} patch(es) successfully.\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
