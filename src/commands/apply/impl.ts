import { resolveConfig } from "../../config/resolver";
import type { ApplyCommandFlags } from "../../config/types";
import type { LocalContext } from "../../context";

export default async function (
  this: LocalContext,
  flags: ApplyCommandFlags,
): Promise<void> {
  try {
    const config = await resolveConfig(flags);

    if (config.verbose) {
      this.process.stdout.write("Configuration resolved:\n");
      this.process.stdout.write(`  Repo directory: ${config.repoDir}\n`);
      this.process.stdout.write(`  Patches directory: ${config.patchesDir}\n`);
      this.process.stdout.write(`  Dry run: ${config.dryRun}\n`);
    }

    if (config.dryRun) {
      this.process.stdout.write(
        "[DRY RUN] Would apply patches from " +
          `${config.patchesDir} to ${config.repoDir}\n`,
      );
    } else {
      this.process.stdout.write("applying..\n");
    }
  } catch (error) {
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
