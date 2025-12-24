import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAllFiles } from "~/lib/fs";
import { applyDiff } from "./apply-diff";

type PatchToApply = {
  relativePath: string;
  absolutePath: string;
  type: "copy" | "diff";
  targetPath: string;
};

type CollectPatchParams = {
  patchSetDir: string;
  repoDir: string;
  exclude?: string[];
};

export const collectPatchToApplys = async (
  params: CollectPatchParams,
): Promise<PatchToApply[]> => {
  const { patchSetDir, repoDir, exclude = [] } = params;
  if (!existsSync(patchSetDir)) {
    return [];
  }
  const relativePaths = await getAllFiles(patchSetDir);
  const excludeSet = new Set(exclude);

  return relativePaths
    .filter((relativePath) => {
      const filename = path.basename(relativePath);
      return !excludeSet.has(filename);
    })
    .map((relativePath) => {
      const absolutePath = path.join(patchSetDir, relativePath);
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

export const applyPatch = async (
  patchFile: PatchToApply,
  verbose: boolean,
  fuzzFactor: number,
  stdout: NodeJS.WriteStream,
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (patchFile.type === "copy") {
      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await copyFile(patchFile.absolutePath, patchFile.targetPath);
      if (verbose) {
        stdout.write(`    Copied: ${patchFile.relativePath}\n`);
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
      const patchedContent = applyDiff(
        originalContent,
        diffContent,
        fuzzFactor,
      );

      await mkdir(path.dirname(patchFile.targetPath), { recursive: true });
      await writeFile(patchFile.targetPath, patchedContent);

      if (verbose) {
        stdout.write(`    Applied diff: ${patchFile.relativePath}\n`);
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
