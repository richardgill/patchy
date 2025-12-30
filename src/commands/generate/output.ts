import { relative } from "node:path";
import type { LocalContext } from "~/context";
import { formatPathForDisplay, toRelativeDisplayPath } from "~/lib/fs";
import { getHookFilenames } from "~/lib/hooks";
import { getExpectedPatchPaths, getStalePatches } from "./patch-operations";

type PrintDryRunOptions = {
  context: LocalContext;
  config: {
    absoluteTargetRepo: string;
    patches_dir: string;
    hook_prefix?: string;
  };
  patchSet: string;
  operations: Array<{ type: string; relativePath: string; destPath: string }>;
  absolutePatchSetDir: string;
};

export const printDryRun = async (
  options: PrintDryRunOptions,
): Promise<void> => {
  const { context, config, patchSet, operations, absolutePatchSetDir } =
    options;

  context.process.stdout.write(
    `[DRY RUN] Would generate patches from ${toRelativeDisplayPath(config.absoluteTargetRepo, context.cwd)} to ${formatPathForDisplay(config.patches_dir)}/${patchSet}/\n`,
  );
  context.process.stdout.write(`Found ${operations.length} change(s):\n`);
  for (const op of operations) {
    context.process.stdout.write(
      `  ${op.type}: ${op.relativePath} -> ${op.destPath}\n`,
    );
  }

  const hookPrefix = config.hook_prefix ?? "patchy-";
  const hookFilenames = getHookFilenames(hookPrefix);
  const expectedPaths = getExpectedPatchPaths(operations);
  const stalePatches = await getStalePatches({
    patchSetDir: absolutePatchSetDir,
    expectedPaths,
    exclude: hookFilenames,
  });
  if (stalePatches.length > 0) {
    context.process.stdout.write(
      `\nWould remove ${stalePatches.length} stale patch(es):\n`,
    );
    for (const stalePath of stalePatches) {
      const relativePath = relative(absolutePatchSetDir, stalePath);
      context.process.stdout.write(`  remove: ${relativePath}\n`);
    }
  }
};

type ReportSuccessOptions = {
  context: LocalContext;
  operationCount: number;
  staleCount: number;
};

export const reportSuccess = (options: ReportSuccessOptions): void => {
  const { context, operationCount, staleCount } = options;
  const removedMsg = staleCount > 0 ? `, removed ${staleCount} stale` : "";
  context.process.stdout.write(
    `Generated ${operationCount} patch(es)${removedMsg} successfully.\n`,
  );
};
