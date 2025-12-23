import { isAbsolutePath } from "~/lib/fs";
import type { MergedConfig } from "./types";

export const hasAbsoluteTargetRepo = (config: MergedConfig): boolean =>
  Boolean(config.target_repo && isAbsolutePath(config.target_repo));
