import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const checkoutFlags = {
  ...m.repo_dir.stricliFlag,
  ...m.repo_base_dir.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  ref: { ...m.ref.stricliFlag.ref, optional: false },
} as const;

export type CheckoutFlags = ParsedFlags<typeof checkoutFlags>;
