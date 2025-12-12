import { FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

const m = FLAG_METADATA;

export const checkoutFlags = {
  ...m.repo_dir.stricliFlag,
  ...m.repo_base_dir.stricliFlag,
  ...m.config.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ref: { ...m.ref.stricliFlag.ref, optional: false },
} as const;

export type CheckoutFlags = ParsedFlags<typeof checkoutFlags>;
