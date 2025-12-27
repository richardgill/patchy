import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const configListFlags = {
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
} as const;

export type ConfigListFlags = ParsedFlags<typeof configListFlags>;
