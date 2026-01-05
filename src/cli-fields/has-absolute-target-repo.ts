import { isAbsolutePath } from "~/lib/fs";
import type { MergedConfig } from "./types";

export const hasAbsoluteTargetRepo = (
  config: Pick<MergedConfig, "target_repo">,
): boolean =>
  Boolean(config.target_repo.value && isAbsolutePath(config.target_repo.value));
