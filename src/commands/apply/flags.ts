import { CONFIG_FIELD_METADATA, CONFIG_FLAG_METADATA } from "~/config/config";
import type { ParsedFlags } from "~/types/utils";

const m = CONFIG_FIELD_METADATA;
const cm = CONFIG_FLAG_METADATA;

export const applyFlags = {
  ...m.repo_base_dir.stricliFlag,
  ...m.repo_dir.stricliFlag,
  ...m.patches_dir.stricliFlag,
  ...m.repo_url.stricliFlag,
  ...m.ref.stricliFlag,
  ...cm.stricliFlag,
  ...m.verbose.stricliFlag,
  ...m.dry_run.stricliFlag,
  "fuzz-factor": {
    kind: "parsed",
    parse: Number,
    brief:
      "Fuzz factor for patch application (higher = more lenient) [env: PATCHY_FUZZ_FACTOR]",
    optional: true,
  },
} as const;

export type ApplyFlags = ParsedFlags<typeof applyFlags>;
