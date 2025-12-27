import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const configGetFlags = {
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
} as const;

export type ConfigGetFlags = ParsedFlags<typeof configGetFlags>;
