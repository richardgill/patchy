import { resolveConfig } from "~/config/resolver";
import type { ApplyCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";

export default async function (
  this: LocalContext,
  flags: ApplyCommandFlags,
): Promise<void> {
  try {
    const config = (await resolveConfig(this, flags)) as ResolvedConfig;

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
