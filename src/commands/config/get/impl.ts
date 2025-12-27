import { createEnrichedMergedConfig } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import {
  COMPUTED_KEY_MAP,
  CONFIG_KEYS,
  type ConfigKey,
  getConfigValue,
} from "../keys";
import type { ConfigGetFlags } from "./flags";

const impl = async function (
  this: LocalContext,
  flags: ConfigGetFlags,
  key: string,
): Promise<void> {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    const validKeys = CONFIG_KEYS.join(", ");
    return exit(this, {
      exitCode: 1,
      stderr: `Unknown config key: ${key}\nValid keys: ${validKeys}`,
    });
  }

  const result = createEnrichedMergedConfig({
    flags,
    cwd: this.cwd,
    env: this.process.env,
    requires: [],
  });

  if (!result.success) {
    return exit(this, { exitCode: 1, stderr: result.error });
  }

  const value = getConfigValue(result.mergedConfig, key as ConfigKey);

  if (value === undefined) {
    const isComputed = key in COMPUTED_KEY_MAP;
    if (isComputed) {
      this.process.stdout.write("\n");
      return;
    }
    return exit(this, { exitCode: 1, stderr: `Key not set: ${key}` });
  }

  this.process.stdout.write(`${value}\n`);
};

export default impl;
