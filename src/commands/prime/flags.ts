import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const primeFlags = {
  ...FLAG_METADATA.config.stricliFlag,
} as const;

export type PrimeFlags = ParsedFlags<typeof primeFlags>;
