#!/usr/bin/env bun

import { z } from "zod";
import { jsonConfigSchema } from "../src/config/schemas";

export const SCHEMA_FILENAME = "patchy.schema.json";

// TODO: Submit to SchemaStore for auto-discovery in IDEs
// See: https://www.schemastore.org/json/
export const generateJsonSchema = () => ({
  title: "Patchy Configuration",
  description:
    "Configuration file for patchy-cli, a tool for managing Git patch workflows",
  ...z.toJSONSchema(jsonConfigSchema),
});
