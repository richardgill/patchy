import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMergedConfig } from "~/config/resolver";
import type { ApplyCommandFlags } from "~/config/types";
import type { LocalContext } from "~/context";
import { getAllFiles } from "~/lib/fs";
import { applyDiff } from "./apply-diff";

type PatchToApply = {
  relativePath: string;
  absolutePath: string;
  type: "copy" | "diff";
  targetPath: string;
};

const collectPatchToApplys = async (
  patchesDir: string,
  repoDir: string,
): Promise<PatchToApply[]> => {
  const relativePaths = await getAllFiles(patchesDir);

  return relativePaths.map((relativePath) => {
    const absolutePath = path.join(patchesDir, relativePath);
    const isDiff = relativePath.endsWith(".diff");
    const targetRelativePath = isDiff
      ? relativePath.slice(0, -5)
      : relativePath;
    const targetPath = path.join(repoDir, targetRelativePath);

    return {
      relativePath,
      absolutePath,
      type: isDiff ? "diff" : "copy",
      targetPath,
    };
  });
};

const applyPatch = async (
  patchFile: PatchToApply,
  verbose: boolean,
  stdout: NodeJS.WriteStream,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (patchFile.type === "copy") {
      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await copyFile(patchFile.absolutePath, patchFile.targetPath);
      if (verbose) {
        stdout.write(`  Copied: ${patchFile.relativePath}\n`);
      }
    } else {
      if (!existsSync(patchFile.targetPath)) {
        return {
          success: false,
          error: `Target file does not exist: ${patchFile.targetPath}`,
        };
      }

      const diffContent = await readFile(patchFile.absolutePath, "utf-8");
      const originalContent = await readFile(patchFile.targetPath, "utf-8");
      const patchedContent = applyDiff(originalContent, diffContent);

      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await writeFile(patchFile.targetPath, patchedContent);

      if (verbose) {
        stdout.write(`  Applied diff: ${patchFile.relativePath}\n`);
      }
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default async function (
  this: LocalContext,
  flags: ApplyCommandFlags,
): Promise<void> {
  try {
    const result = createMergedConfig({
      flags,
      requiredFields: ["repo_base_dir", "repo_dir", "patches_dir"],
    });

    if (!result.success) {
      this.process.stderr.write(result.error);
      this.process.exit(1);
      return;
    }

    const config = result.mergedConfig;
    const absolutePatchesDir = config.absolutePatchesDir ?? "";
    const absoluteRepoDir = config.absoluteRepoDir ?? "";

    if (config.dry_run) {
      this.process.stdout.write(
        "[DRY RUN] Would apply patches from " +
          `${config.patches_dir} to ${config.repo_dir}\n`,
      );
    }

    const patchFiles = await collectPatchToApplys(
      absolutePatchesDir,
      absoluteRepoDir,
    );

    if (patchFiles.length === 0) {
      this.process.stdout.write("No patch files found.\n");
      return;
    }

    if (config.dry_run) {
      this.process.stdout.write(
        `\nWould apply ${patchFiles.length} file(s):\n`,
      );
      for (const patchFile of patchFiles) {
        const action = patchFile.type === "copy" ? "Copy" : "Apply diff";
        this.process.stdout.write(`  ${action}: ${patchFile.relativePath}\n`);
      }
      return;
    }

    this.process.stdout.write(
      `Applying ${patchFiles.length} patch file(s)...\n`,
    );

    const errors: Array<{ file: string; error: string }> = [];

    for (const patchFile of patchFiles) {
      const patchResult = await applyPatch(
        patchFile,
        config.verbose,
        this.process.stdout as NodeJS.WriteStream,
      );
      if (!patchResult.success && patchResult.error) {
        errors.push({ file: patchFile.relativePath, error: patchResult.error });
      }
    }

    if (errors.length > 0) {
      this.process.stderr.write(`\nErrors occurred while applying patches:\n`);
      for (const { file, error } of errors) {
        this.process.stderr.write(`  ${file}: ${error}\n`);
      }
      this.process.exit(1);
      return;
    }

    this.process.stdout.write(
      `Successfully applied ${patchFiles.length} patch file(s).\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit(1);
  }
}
