import type { ConfigSource, ResolvedValue } from "~/lib/cli-config";

export const rv = <T>(
  value: T,
  source: ConfigSource = "config",
): ResolvedValue<T> => ({
  value,
  source,
});
