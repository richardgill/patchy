import path from "node:path";
import { sumBy } from "es-toolkit";
import pluralize from "pluralize";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay } from "~/lib/fs";
import { CHECK_MARK, CROSS_MARK } from "~/lib/symbols";
import { commitPatchSetIfNeeded, ensureCleanWorkingTree } from "./commit";
import { loadAndValidateConfig } from "./config";
import type { ApplyFlags } from "./flags";
import {
  applySinglePatchSet,
  type PatchSetStats,
  resolvePatchSetsToApply,
} from "./patch-set";

type ReportResultsOptions = {
  context: LocalContext;
  stats: PatchSetStats[];
  dryRun: boolean;
  targetRepo: string;
};

const reportResults = (options: ReportResultsOptions): void => {
  const { context, stats, dryRun, targetRepo } = options;
  const totalFiles = sumBy(stats, (s) => s.fileCount);
  const allErrors = stats.flatMap((s) => s.errors);
  const targetPath = formatPathForDisplay(targetRepo);
  const fileWord = pluralize("file", totalFiles);
  const setWord = pluralize("patch set", stats.length);

  if (allErrors.length > 0) {
    context.process.stderr.write(`\nErrors occurred while applying patches:\n`);
    for (const { file, error } of allErrors) {
      context.process.stderr.write(`  ${file}: ${error}\n`);
    }
    context.process.stderr.write(
      `\n${CROSS_MARK} Failed to apply patches to ${targetPath}\n`,
    );
    exit(context, { exitCode: 1 });
  }

  if (dryRun) {
    context.process.stdout.write(
      `\n[DRY RUN] Would apply ${totalFiles} ${fileWord} across ${stats.length} ${setWord} to ${targetPath}\n`,
    );
  } else {
    context.process.stdout.write(
      `\n${CHECK_MARK} Applied ${totalFiles} ${fileWord} across ${stats.length} ${setWord} to ${targetPath}\n`,
    );
  }
};

export default async function (
  this: LocalContext,
  flags: ApplyFlags,
): Promise<void> {
  const config = loadAndValidateConfig(this, flags);

  const patchSets = resolvePatchSetsToApply(
    this,
    config.absolutePatchesDir,
    flags,
  );
  if (patchSets.length === 0) {
    this.process.stdout.write("No patch sets found.\n");
    return;
  }

  if (!config.dry_run) {
    await ensureCleanWorkingTree(this, config.absoluteTargetRepo);
  }

  const dryRunPrefix = config.dry_run ? "[DRY RUN] " : "";
  this.process.stdout.write(
    `${dryRunPrefix}Applying patches from ${formatPathForDisplay(config.patches_dir)} to ${formatPathForDisplay(config.target_repo)}...\n\n`,
  );

  const stats: PatchSetStats[] = [];

  for (let i = 0; i < patchSets.length; i++) {
    const patchSetName = patchSets[i];
    const isLast = i === patchSets.length - 1;
    const patchSetDir = path.join(config.absolutePatchesDir, patchSetName);

    const result = await applySinglePatchSet({
      context: this,
      patchSetDir,
      repoDir: config.absoluteTargetRepo,
      patchSetName,
      dryRun: config.dry_run,
      verbose: config.verbose,
      fuzzFactor: config.fuzzFactor,
      hookPrefix: config.hook_prefix,
      patchesDir: config.absolutePatchesDir,
      baseRevision: config.base_revision,
    });

    if (result.errors.length > 0) {
      stats.push(result);
      reportResults({
        context: this,
        stats,
        dryRun: config.dry_run,
        targetRepo: config.target_repo,
      });
      return;
    }

    const commitResult = await commitPatchSetIfNeeded({
      context: this,
      repoDir: config.absoluteTargetRepo,
      patchSetName,
      autoCommit: flags["auto-commit"],
      isLastPatchSet: isLast,
      dryRun: config.dry_run,
    });
    if (commitResult.cancelled) {
      return exit(this, { exitCode: 1 });
    }

    stats.push(result);
  }

  reportResults({
    context: this,
    stats,
    dryRun: config.dry_run,
    targetRepo: config.target_repo,
  });
}
