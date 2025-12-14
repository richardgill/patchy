import { type ZodTypeAny, z } from "zod";
import { FLAG_METADATA } from "./metadata";
import { JSON_CONFIG_KEYS, type JsonConfigKey } from "./types";

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
    if (meta.type === "boolean") {
      fields[key] = z.boolean().default(false);
    } else if (meta.requiredInConfig) {
      fields[key] = z.string().min(1, `${meta.name} is required`);
    } else {
      fields[key] = z.string();
    }
  }
  return fields as BaseConfigFields;
};

const baseConfigFields = buildBaseConfigFields();

export const jsonConfigSchema = z
  .object(baseConfigFields)
  .partial()
  .extend({
    $schema: z.string().optional(),
  })
  .strict();

export type JsonConfig = z.infer<typeof jsonConfigSchema>;
