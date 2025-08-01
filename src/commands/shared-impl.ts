import type { ResolvedConfig } from "../config/types";
import type { LocalContext } from "../context";

export const logConfiguration = (
  context: LocalContext,
  config: ResolvedConfig,
): void => {
  if (config.verbose) {
    context.process.stdout.write("Configuration resolved:\n");
    context.process.stdout.write(`  repo_url: ${config.repoUrl}\n`);
    context.process.stdout.write(`  repo_dir: ${config.repoDir}\n`);
    context.process.stdout.write(`  repo_base_dir: ${config.repoBaseDir}\n`);
    context.process.stdout.write(`  patches_dir: ${config.patchesDir}\n`);
    context.process.stdout.write(`  ref: ${config.ref}\n`);
    context.process.stdout.write(`  verbose: ${config.verbose}\n`);
    context.process.stdout.write(`  dry_run: ${config.dryRun}\n`);
  }
};
