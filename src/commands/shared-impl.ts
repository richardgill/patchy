import type { ResolvedConfig } from "../config/types";
import type { LocalContext } from "../context";

export const logConfiguration = (
  context: LocalContext,
  config: ResolvedConfig,
): void => {
  if (config.verbose) {
    context.process.stdout.write("Configuration resolved:\n");
    context.process.stdout.write(`  Repo directory: ${config.repoDir}\n`);
    context.process.stdout.write(`  Patches directory: ${config.patchesDir}\n`);
    context.process.stdout.write(`  Dry run: ${config.dryRun}\n`);
  }
};
