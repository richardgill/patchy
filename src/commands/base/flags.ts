import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const baseFlags = {
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
} as const;

export type BaseFlags = ParsedFlags<typeof baseFlags>;
