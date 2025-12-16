import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compact, sumBy } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  DEFAULT_FUZZ_FACTOR,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { formatPathForDisplay, getAllFiles, getSortedFolders } from "~/lib/fs";
import { applyDiff } from "./apply-diff";
import type { ApplyFlags } from "./flags";

type PatchToApply = {
  relativePath: string;
  absolutePath: string;
  type: "copy" | "diff";
  targetPath: string;
};

type PatchSetStats = {
  name: string;
  fileCount: number;
  errors: Array<{ file: string; error: string }>;
};

const collectPatchToApplys = async (
  patchSetDir: string,
  repoDir: string,
): Promise<PatchToApply[]> => {
  if (!existsSync(patchSetDir)) {
    return [];
  }
  const relativePaths = await getAllFiles(patchSetDir);

  return relativePaths.map((relativePath) => {
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

const applyPatch = async (
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

type FilterResult =
  | { filtered: string[]; error?: undefined }
  | { filtered?: undefined; error: string };

const filterPatchSets = (
  patchSets: string[],
  only: string | undefined,
  until: string | undefined,
): FilterResult => {
  if (only && until) {
    return { error: "Cannot use both --only and --until flags together" };
  }

  if (only) {
    if (!patchSets.includes(only)) {
      return { error: `Patch set not found: ${only}` };
    }
    return { filtered: [only] };
  }

  if (until) {
    const index = patchSets.indexOf(until);
    if (index === -1) {
      return { error: `Patch set not found: ${until}` };
    }
    return { filtered: patchSets.slice(0, index + 1) };
  }

  return { filtered: patchSets };
};

export default async function (
  this: LocalContext,
  flags: ApplyFlags,
): Promise<void> {
  try {
    const result = createEnrichedMergedConfig({
      flags,
      requiredFields: (config) =>
        compact([
          !hasAbsoluteTargetRepo(config) && "clones_dir",
          "target_repo",
          "patches_dir",
        ]),
      cwd: this.cwd,
      env: this.process.env,
    });

    if (!result.success) {
      this.process.stderr.write(result.error);
      this.process.exit(1);
      return;
    }

    const config = result.mergedConfig;
    const absolutePatchesDir = config.absolutePatchesDir ?? "";
    const absoluteTargetRepo = config.absoluteTargetRepo ?? "";

    const allPatchSets = getSortedFolders(absolutePatchesDir);

    if (allPatchSets.length === 0) {
      this.process.stdout.write("No patch sets found.\n");
      return;
    }

    const filterResult = filterPatchSets(allPatchSets, flags.only, flags.until);

    if (filterResult.error !== undefined) {
      this.process.stderr.write(`${filterResult.error}\n`);
      this.process.exit(1);
      return;
    }

    const patchSetsToApply = filterResult.filtered;

    if (config.dry_run) {
      this.process.stdout.write(
        `[DRY RUN] Would apply patches from ${formatPathForDisplay(config.patches_dir ?? "")} to ${formatPathForDisplay(config.target_repo ?? "")}\n`,
      );
    }

    const fuzzFactor = flags["fuzz-factor"] ?? DEFAULT_FUZZ_FACTOR;
    const stats: PatchSetStats[] = [];

    this.process.stdout.write("Applying patch sets...\n");

    for (const patchSetName of patchSetsToApply) {
      const patchSetDir = path.join(absolutePatchesDir, patchSetName);
      const patchFiles = await collectPatchToApplys(
        patchSetDir,
        absoluteTargetRepo,
      );

      const patchSetStats: PatchSetStats = {
        name: patchSetName,
        fileCount: patchFiles.length,
        errors: [],
      };

      if (config.dry_run) {
        this.process.stdout.write(
          `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
        );
        if (config.verbose) {
          for (const patchFile of patchFiles) {
            const action = patchFile.type === "copy" ? "Copy" : "Apply diff";
            this.process.stdout.write(
              `    ${action}: ${patchFile.relativePath}\n`,
            );
          }
        }
        stats.push(patchSetStats);
        continue;
      }

      this.process.stdout.write(
        `  [${patchSetName}] ${patchFiles.length} file(s)\n`,
      );

      for (const patchFile of patchFiles) {
        const patchResult = await applyPatch(
          patchFile,
          config.verbose,
          fuzzFactor,
          this.process.stdout as NodeJS.WriteStream,
        );
        if (!patchResult.success && patchResult.error) {
          patchSetStats.errors.push({
            file: patchFile.relativePath,
            error: patchResult.error,
          });
        }
      }

      stats.push(patchSetStats);
    }

    const totalFiles = sumBy(stats, (s) => s.fileCount);
    const allErrors = stats.flatMap((s) => s.errors);

    if (allErrors.length > 0) {
      this.process.stderr.write(`\nErrors occurred while applying patches:\n`);
      for (const { file, error } of allErrors) {
        this.process.stderr.write(`  ${file}: ${error}\n`);
      }
      this.process.exit(1);
      return;
    }

    this.process.stdout.write(
      `Successfully applied ${totalFiles} patch file(s) across ${stats.length} patch set(s).\n`,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ProcessExitError") {
      throw error;
    }
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit(1);
  }
}
