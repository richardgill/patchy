import { compact } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  DEFAULT_FUZZ_FACTOR,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import type { ApplyFlags } from "./flags";

type ApplyConfig = {
  absolutePatchesDir: string;
  absoluteTargetRepo: string;
  patches_dir: string;
  target_repo: string;
  dry_run: boolean;
  verbose: boolean;
  fuzzFactor: number;
};

const validateCommitFlags = (
  all: boolean | undefined,
  edit: boolean | undefined,
): { error?: string } => {
  if (all && edit) {
    return { error: "Cannot use both --all and --edit flags together" };
  }
  return {};
};

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: ApplyFlags,
): ApplyConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([
        !hasAbsoluteTargetRepo(config) && "clones_dir",
        "target_repo",
        "patches_dir",
      ]),
    cwd: context.cwd,
    env: context.process.env,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const flagValidation = validateCommitFlags(flags.all, flags.edit);
  if (flagValidation.error !== undefined) {
    return exit(context, { exitCode: 1, stderr: flagValidation.error });
  }

  const config = result.mergedConfig;
  return {
    absolutePatchesDir: config.absolutePatchesDir ?? "",
    absoluteTargetRepo: config.absoluteTargetRepo ?? "",
    patches_dir: config.patches_dir ?? "",
    target_repo: config.target_repo ?? "",
    dry_run: config.dry_run,
    verbose: config.verbose,
    fuzzFactor: flags["fuzz-factor"] ?? DEFAULT_FUZZ_FACTOR,
  };
};
