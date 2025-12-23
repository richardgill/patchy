import { compact } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";
import { exit } from "~/lib/exit";
import type { ResetFlags } from "./flags";

type ResetConfig = {
  repoDir: string;
  baseRevision: string;
  dryRun: boolean;
  verbose: boolean;
  skipConfirmation: boolean;
};

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: ResetFlags,
): ResetConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([!hasAbsoluteTargetRepo(config) && "clones_dir", "target_repo"]),
    cwd: context.cwd,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  return {
    repoDir: config.absoluteTargetRepo ?? "",
    baseRevision: assertDefined(config.base_revision, "base_revision"),
    dryRun: config.dry_run,
    verbose: config.verbose,
    skipConfirmation: flags.yes ?? false,
  };
};
