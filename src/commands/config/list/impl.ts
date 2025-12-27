import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { CONFIG_KEYS, type ConfigKey, getConfigValue } from "../keys";
import type { ConfigListFlags } from "./flags";

const impl = async function (
  this: LocalContext,
  flags: ConfigListFlags,
): Promise<void> {
  const result = createEnrichedMergedConfig({
    flags,
    cwd: this.cwd,
    env: this.process.env,
    requires: [],
  });

  if (!result.success) {
    return exit(this, { exitCode: 1, stderr: result.error });
  }

  const maxKeyLength = Math.max(...CONFIG_KEYS.map((k) => k.length));

  for (const key of CONFIG_KEYS) {
    const value = getConfigValue(result.mergedConfig, key as ConfigKey);
    if (value !== undefined) {
      const paddedKey = key.padEnd(maxKeyLength);
      this.process.stdout.write(`${paddedKey}  ${value}\n`);
    }
  }
};

export default impl;
