import { z } from "zod";
import { CONFIG_FIELD_METADATA } from "./metadata";

const m = CONFIG_FIELD_METADATA;

const baseConfigFields = {
  repo_url: z.string().min(1, `${m.repo_url.name} is required`),
  ref: z.string().min(1, `${m.ref.name} is required`),
  repo_base_dir: z.string().min(1, `${m.repo_base_dir.name} is required`),
  repo_dir: z.string().min(1, `${m.repo_dir.name} is required`),
  patches_dir: z.string().min(1, `${m.patches_dir.name} is required`),
  verbose: z.boolean().default(false),
};

export const requiredConfigSchema = z.object(baseConfigFields).strict();

export type RequiredConfigData = z.infer<typeof requiredConfigSchema>;

export const jsonConfigSchema = z
  .object({
    $schema: z.string().optional(),
    repo_url: baseConfigFields.repo_url.optional(),
    ref: baseConfigFields.ref.optional(),
    repo_base_dir: baseConfigFields.repo_base_dir.optional(),
    repo_dir: baseConfigFields.repo_dir.optional(),
    patches_dir: baseConfigFields.patches_dir.optional(),
    verbose: baseConfigFields.verbose.optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();
export type JsonConfig = z.infer<typeof jsonConfigSchema>;
