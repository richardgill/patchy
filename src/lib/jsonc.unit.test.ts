import { describe, expect, it } from "bun:test";
import { parseJsonc, updateJsoncField } from "./jsonc";

describe("parseJsonc", () => {
  it("should parse valid JSON successfully", () => {
    const json = `{"name": "test", "value": 123}`;
    const result = parseJsonc(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.json).toEqual({ name: "test", value: 123 });
    }
  });

  it("should parse JSON with comments", () => {
    const json = `{
      // This is a comment
      "name": "test",
      /* Block comment */
      "value": 123
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.json).toEqual({ name: "test", value: 123 });
    }
  });

  it("should parse JSON with trailing commas", () => {
    const json = `{
      "name": "test",
      "value": 123,
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.json).toEqual({ name: "test", value: 123 });
    }
  });

  it("should handle empty object", () => {
    const json = `{}`;
    const result = parseJsonc(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.json).toEqual({});
    }
  });

  it("should handle empty array", () => {
    const json = `[]`;
    const result = parseJsonc(json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.json).toEqual([]);
    }
  });

  it("should fail on invalid JSON with missing comma", () => {
    const json = `{
      "name": "test"
      "value": 123
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: CommaExpected

             1 | {
             2 |       "name": "test"
        >    3 |       "value": 123
                      ^
             4 |     }"
      `);
    }
  });

  it("should fail on invalid JSON with invalid character", () => {
    const json = `{ invalid json: content }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: InvalidSymbol

        >    1 | { invalid json: content }
                  ^"
      `);
    }
  });

  it("should fail on empty string", () => {
    const json = ``;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: ValueExpected

        >    1 | 
                ^"
      `);
    }
  });

  it("should fail on invalid JSON with unexpected token", () => {
    const json = `{
      "name": "test",
      "value": true"
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: UnexpectedEndOfString

             1 | {
             2 |       "name": "test",
        >    3 |       "value": true"
                                   ^
             4 |     }"
      `);
    }
  });

  it("should show context for deeply nested errors", () => {
    const json = `{
      "outer": {
        "inner": {
          "deep": {
            "invalid" true
          }
        }
      }
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: ColonExpected

             3 |         "inner": {
             4 |           "deep": {
        >    5 |             "invalid" true
                                      ^
             6 |           }
             7 |         }"
      `);
    }
  });

  it("should handle multi-line strings in error context", () => {
    const json = `{
      "description": "This is a
      multi-line string
      that is invalid",
      "value": 123
    }`;
    const result = parseJsonc(json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "JSON parse error: UnexpectedEndOfString

             1 | {
        >    2 |       "description": "This is a
                                     ^
             3 |       multi-line string
             4 |       that is invalid","
      `);
    }
  });

  it("should preserve type information with generics", () => {
    interface TestConfig {
      name: string;
      port: number;
    }

    const json = `{"name": "app", "port": 3000}`;
    const result = parseJsonc<TestConfig>(json);

    expect(result.success).toBe(true);
    if (result.success) {
      // TypeScript should know result.json is TestConfig
      expect(result.json.name).toBe("app");
      expect(result.json.port).toBe(3000);
    }
  });
});

describe("updateJsoncField", () => {
  it("should add a new field to JSON", () => {
    const input = `{
  "source_repo": "https://github.com/foo/bar"
}`;
    const result = updateJsoncField(input, "target_repo", "my-repo");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain('"target_repo": "my-repo"');
      expect(result.content).toContain('"source_repo"');
    }
  });

  it("should update an existing field", () => {
    const input = `{
  "source_repo": "https://github.com/foo/bar",
  "target_repo": "old-repo"
}`;
    const result = updateJsoncField(input, "target_repo", "new-repo");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain('"target_repo": "new-repo"');
      expect(result.content).not.toContain("old-repo");
    }
  });

  it("should preserve comments", () => {
    const input = `{
  // This is a comment
  "source_repo": "https://github.com/foo/bar"
}`;
    const result = updateJsoncField(input, "target_repo", "my-repo");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain("// This is a comment");
    }
  });
});
