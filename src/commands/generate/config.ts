import { createEnrichedMergedConfig, REQUIRE_TARGET_REPO } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import type { GenerateFlags } from "./flags";

type GenerateConfig = {
  absolutePatchesDir: string;
  absoluteTargetRepo: string;
  patches_dir: string;
  target_repo: string;
  patch_set: string | undefined;
  dry_run: boolean;
  hook_prefix: string | undefined;
};

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: GenerateFlags,
): GenerateConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requires: [REQUIRE_TARGET_REPO],
    cwd: context.cwd,
    env: context.process.env,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  return {
    absolutePatchesDir: config.absolutePatchesDir,
    absoluteTargetRepo: config.absoluteTargetRepo,
    patches_dir: config.patches_dir.value,
    target_repo: config.target_repo.value,
    patch_set: config.patch_set.value,
    dry_run: config.dry_run.value,
    hook_prefix: config.hook_prefix.value,
  };
};
