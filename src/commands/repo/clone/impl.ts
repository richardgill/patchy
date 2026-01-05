import type { LocalContext } from "~/context";
import { performClone } from "./clone";
import { loadAndValidateConfig, logVerboseInfo, reportDryRun } from "./config";
import type { CloneFlags } from "./flags";
import { promptConfigSave } from "./prompt";

export default async function (
  this: LocalContext,
  flags: CloneFlags,
): Promise<void> {
  const config = loadAndValidateConfig(this, flags);

  if (config.verbose) {
    logVerboseInfo(this, config);
  }

  if (config.dry_run) {
    reportDryRun(this, config);
    return;
  }

  await performClone(this, config);
  await promptConfigSave(this, config);
}
