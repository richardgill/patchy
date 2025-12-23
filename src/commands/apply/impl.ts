import path from "node:path";
import { sumBy } from "es-toolkit";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay } from "~/lib/fs";
import { commitPatchSetIfNeeded, ensureCleanWorkingTree } from "./commit";
import { loadAndValidateConfig } from "./config";
import { type ApplyFlags, validateCommitFlags } from "./flags";
import {
  applySinglePatchSet,
  type PatchSetStats,
  resolvePatchSetsToApply,
} from "./patch-set";

type ReportResultsOptions = {
  context: LocalContext;
  stats: PatchSetStats[];
  dryRun: boolean;
};

const reportResults = (options: ReportResultsOptions): void => {
  const { context, stats, dryRun } = options;
  const totalFiles = sumBy(stats, (s) => s.fileCount);
  const allErrors = stats.flatMap((s) => s.errors);

  if (allErrors.length > 0) {
    context.process.stderr.write(`\nErrors occurred while applying patches:\n`);
    for (const { file, error } of allErrors) {
      context.process.stderr.write(`  ${file}: ${error}\n`);
    }
    exit(context, { exitCode: 1 });
  }

  const prefix = dryRun ? "[DRY RUN] Would apply" : "Successfully applied";
  context.process.stdout.write(
    `${prefix} ${totalFiles} patch file(s) across ${stats.length} patch set(s).\n`,
  );
};

export default async function (
  this: LocalContext,
  flags: ApplyFlags,
): Promise<void> {
  const flagValidation = validateCommitFlags(flags.all, flags.edit);
  if (flagValidation.error !== undefined) {
    return exit(this, { exitCode: 1, stderr: flagValidation.error });
  }

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
    });

    const commitResult = await commitPatchSetIfNeeded({
      context: this,
      repoDir: config.absoluteTargetRepo,
      patchSetName,
      flags,
      isLastPatchSet: isLast,
      dryRun: config.dry_run,
      hasErrors: result.errors.length > 0,
    });
    if (commitResult.cancelled) {
      return exit(this, { exitCode: 1 });
    }

    stats.push(result);
  }

  reportResults({ context: this, stats, dryRun: config.dry_run });
}
