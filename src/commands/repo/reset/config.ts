import {
  createEnrichedMergedConfig,
  REQUIRE_BASE_REVISION,
  REQUIRE_TARGET_REPO,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
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
    requires: [REQUIRE_TARGET_REPO, REQUIRE_BASE_REVISION],
    cwd: context.cwd,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  return {
    repoDir: config.absoluteTargetRepo,
    baseRevision: config.base_revision.value,
    dryRun: config.dry_run.value,
    verbose: config.verbose.value,
    skipConfirmation: flags.yes ?? false,
  };
};
