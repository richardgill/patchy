import { compact } from "es-toolkit";
import {
  createEnrichedMergedConfig,
  hasAbsoluteTargetRepo,
} from "~/cli-fields";
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
};

export const loadAndValidateConfig = (
  context: LocalContext,
  flags: GenerateFlags,
): GenerateConfig => {
  const result = createEnrichedMergedConfig({
    flags,
    requiredFields: (config) =>
      compact([!hasAbsoluteTargetRepo(config) && "clones_dir", "target_repo"]),
    cwd: context.cwd,
    env: context.process.env,
  });

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const config = result.mergedConfig;
  return {
    absolutePatchesDir: config.absolutePatchesDir ?? "",
    absoluteTargetRepo: config.absoluteTargetRepo ?? "",
    patches_dir: config.patches_dir ?? "",
    target_repo: config.target_repo ?? "",
    patch_set: config.patch_set,
    dry_run: config.dry_run,
  };
};
