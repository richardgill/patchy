import { describe, expect, it } from "bun:test";
import { generateJsonSchema } from "./generate-schema";

describe("generateJsonSchema", () => {
  it("should generate expected JSON schema", () => {
    expect(generateJsonSchema()).toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "additionalProperties": false,
        "description": "Configuration file for patchy-cli, a tool for managing Git patch workflows",
        "properties": {
          "$schema": {
            "type": "string",
          },
          "dry_run": {
            "type": "boolean",
          },
          "patches_dir": {
            "minLength": 1,
            "type": "string",
          },
          "ref": {
            "minLength": 1,
            "type": "string",
          },
          "repo_base_dir": {
            "minLength": 1,
            "type": "string",
          },
          "repo_dir": {
            "minLength": 1,
            "type": "string",
          },
          "repo_url": {
            "minLength": 1,
            "type": "string",
          },
          "verbose": {
            "default": false,
            "type": "boolean",
          },
        },
        "title": "Patchy Configuration",
        "type": "object",
      }
    `);
  });
});
