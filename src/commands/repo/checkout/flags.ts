import { FLAG_METADATA } from "~/cli-fields";
import type { ParsedFlags } from "~/types/utils";

export const checkoutFlags = {
  ...FLAG_METADATA.target_repo.stricliFlag,
  ...FLAG_METADATA.clones_dir.stricliFlag,
  ...FLAG_METADATA.config.stricliFlag,
  ...FLAG_METADATA.verbose.stricliFlag,
  ...FLAG_METADATA.dry_run.stricliFlag,
  ref: { ...FLAG_METADATA.ref.stricliFlag.ref, optional: false },
} as const;

export type CheckoutFlags = ParsedFlags<typeof checkoutFlags>;
