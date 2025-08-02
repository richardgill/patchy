import { resolveConfig } from "../../config/resolver";
import type { GenerateCommandFlags, ResolvedConfig } from "../../config/types";
import type { LocalContext } from "../../context";

export default async function (
  this: LocalContext,
  flags: GenerateCommandFlags,
): Promise<void> {
  try {
    const config = (await resolveConfig(this, flags)) as ResolvedConfig;

    if (config.dryRun) {
      this.process.stdout.write(
        "[DRY RUN] Would generate patches from " +
          `${config.repoDir} to ${config.patchesDir}\n`,
      );
    } else {
      this.process.stdout.write("Generating patches...\n");
    }
  } catch (error) {
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
