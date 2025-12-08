import { exec } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { resolveConfig } from "~/config/resolver";
import type { GenerateCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";

const execAsync = promisify(exec);

const getCleanGitEnv = (): NodeJS.ProcessEnv => {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
};

type GitChange = {
  type: "modified" | "new";
  path: string;
};

const getGitChanges = async (repoDir: string): Promise<GitChange[]> => {
  const changes: GitChange[] = [];
  const env = getCleanGitEnv();

  const { stdout: diffOutput } = await execAsync("git diff --name-only HEAD", {
    cwd: repoDir,
    env,
  });
  const modifiedFiles = diffOutput
    .split("\n")
    .filter((line) => line.trim().length > 0);

  for (const file of modifiedFiles) {
    changes.push({ type: "modified", path: file });
  }

  const { stdout: statusOutput } = await execAsync(
    "git status --porcelain -uall",
    { cwd: repoDir, env },
  );
  const statusLines = statusOutput
    .split("\n")
    .filter((line) => line.trim().length > 0);

  for (const line of statusLines) {
    const status = line.substring(0, 2);
    const filePath = line.substring(3).trim();

    if (filePath.endsWith("/")) {
      continue;
    }

    if (status === "??" || status === "A ") {
      changes.push({ type: "new", path: filePath });
    }
  }

  return changes;
};

const generateDiff = async (
  repoDir: string,
  filePath: string,
): Promise<string> => {
  const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, {
    cwd: repoDir,
    env: getCleanGitEnv(),
  });
  return stdout;
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
