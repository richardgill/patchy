import { omit } from "es-toolkit";
import { type ZodTypeAny, z } from "zod";
import { CONFIG_FIELD_METADATA, type JsonConfigKey } from "./config";

// Type-level mapping from metadata type strings to Zod schema types
type ZodSchemaFor<T extends "string" | "boolean"> = T extends "boolean"
  ? z.ZodDefault<z.ZodBoolean>
  : z.ZodString;

// Strongly typed baseConfigFields shape (excludes dry_run which is JSON-only)
type BaseConfigFields = {
  [K in Exclude<JsonConfigKey, "dry_run">]: ZodSchemaFor<
    (typeof CONFIG_FIELD_METADATA)[K]["type"]
  >;
};

// Build Zod schemas from metadata at runtime (dry_run excluded - it's JSON-only)
const buildBaseConfigFields = (): BaseConfigFields => {
  const fields: Record<string, ZodTypeAny> = {};
  for (const [key, meta] of Object.entries(
    omit(CONFIG_FIELD_METADATA, ["dry_run"]),
  )) {
    fields[key] =
      meta.type === "boolean"
        ? z.boolean().default(false)
        : z.string().min(1, `${meta.name} is required`);
  }
  return fields as BaseConfigFields;
};

const baseConfigFields = buildBaseConfigFields();

export const requiredConfigSchema = z.object(baseConfigFields).strict();

export type RequiredConfigData = z.infer<typeof requiredConfigSchema>;

export const jsonConfigSchema = z
  .object(baseConfigFields)
  .partial()
  .extend({
    $schema: z.string().optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();
export type JsonConfig = z.infer<typeof jsonConfigSchema>;
