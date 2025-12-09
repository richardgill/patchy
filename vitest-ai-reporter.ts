import type { File } from "vitest";
import { DefaultReporter } from "vitest/reporters";

export class AIFriendlyReporter extends DefaultReporter {
  onFinished(files?: File[], errors?: unknown[]) {
    // Let the parent DefaultReporter do its normal output
    super.onFinished(files, errors);

    // Check if there are snapshot failures using the built-in summary
    const snapshotSummary = this.ctx.snapshot?.summary;
    if (
      snapshotSummary &&
      (snapshotSummary.unmatched > 0 || snapshotSummary.filesUnmatched > 0)
    ) {
      console.log("\nSnapshot Failures Detected:");
      console.log("─".repeat(50));
      console.log(`  Failed snapshots: ${snapshotSummary.unmatched}`);

      console.log("\nTo update snapshots, run:");
      console.log(`   bun run test -u`);
    }
  }
}
