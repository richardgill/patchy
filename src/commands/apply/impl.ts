import { resolveConfig } from "../../config/resolver";
import type { ApplyCommandFlags, ResolvedConfig } from "../../config/types";
import type { LocalContext } from "../../context";

export default async function (
  this: LocalContext,
  flags: ApplyCommandFlags,
): Promise<void> {
  try {
    const config = (await resolveConfig(this, flags, [
      "repoUrl",
      "repoDir",
    ])) as ResolvedConfig;

    if (config.dry_run) {
      this.process.stdout.write(
        "[DRY RUN] Would apply patches from " +
          `${config.patches_dir} to ${config.repo_dir}\n`,
      );
    } else {
      this.process.stdout.write("applying..\n");
    }
  } catch (error) {
    this.process.stderr.write(`Error: ${error}\n`);
    this.process.exit?.(1);
  }
}
