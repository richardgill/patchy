import {
  createEnrichedMergedConfig,
  DEFAULT_FUZZ_FACTOR,
  REQUIRE_PATCHES_DIR,
  REQUIRE_TARGET_REPO,
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

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: ApplyFlags,
): ApplyConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requires: [REQUIRE_TARGET_REPO, REQUIRE_PATCHES_DIR],
    cwd: context.cwd,
    env: context.process.env,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  return {
    ...config,
    fuzzFactor: flags["fuzz-factor"] ?? DEFAULT_FUZZ_FACTOR,
  };
};
