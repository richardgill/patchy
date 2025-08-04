import { resolveConfig } from "~/config/resolver";
import type { GenerateCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";

export default async function (
  this: LocalContext,
  flags: GenerateCommandFlags,
): Promise<void> {
  try {
    const config = (await resolveConfig(this, flags, [
      "repo_url",
      "repo_dir",
    ])) as ResolvedConfig;

    if (config.dry_run) {
      this.process.stdout.write(
        "[DRY RUN] Would generate patches from " +
          `${config.repo_dir} to ${config.patches_dir}\n`,
      );
    } else {
      this.process.stdout.write("Generating patches...\n");
    }
  } catch (error) {
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
