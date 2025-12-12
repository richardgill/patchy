import { type ZodTypeAny, z } from "zod";
import { FLAG_METADATA, JSON_CONFIG_KEYS, type JsonConfigKey } from "./config";

// Type-level mapping from metadata type strings to Zod schema types
type ZodSchemaFor<T extends "string" | "boolean"> = T extends "boolean"
  ? z.ZodDefault<z.ZodBoolean>
  : z.ZodString;

// Strongly typed baseConfigFields shape
type BaseConfigFields = {
  [K in JsonConfigKey]: ZodSchemaFor<(typeof FLAG_METADATA)[K]["type"]>;
};

// Build Zod schemas from metadata at runtime (only configField: true)
const buildBaseConfigFields = (): BaseConfigFields => {
  const fields: Record<string, ZodTypeAny> = {};
  for (const key of JSON_CONFIG_KEYS) {
    const meta = FLAG_METADATA[key];
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
  })
  .strict();
export type JsonConfig = z.infer<typeof jsonConfigSchema>;
