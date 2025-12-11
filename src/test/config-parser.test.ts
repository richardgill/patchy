import { describe, expect, it } from "bun:test";
import { parseOptionalJsonConfig } from "../config/resolver";

describe("parseOptionalJsonConfig", () => {
  it("should parse valid config successfully", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        ref: "main",
        verbose: true,
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        repo_url: "https://github.com/user/repo.git",
        ref: "main",
        verbose: true,
      });
    }
  });

  it("should return empty object for undefined input", () => {
    const result = parseOptionalJsonConfig(undefined);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it("should handle empty string fields with custom error messages", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "",
        ref: "",
        repo_base_dir: "",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "repo_url: Repository URL is required
          repo_base_dir: Repository base directory is required
          ref: Git reference is required"
      `);
    }
  });

  it("should fail with type errors for wrong field types", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: 123,
        verbose: "not-a-boolean",
        ref: ["array", "not", "string"],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "repo_url: Invalid input: expected string, received number
          ref: Invalid input: expected string, received array
          verbose: Invalid input: expected boolean, received string"
      `);
    }
  });

  it("should fail with strict mode error for unknown fields", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        unknown_field: "value",
        another_unknown: 123,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unrecognized key");
    }
  });

  it("should handle dry_run field correctly", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        dry_run: true,
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ verbose: false, dry_run: true });
    }
  });

  it("should fail for dry_run with wrong type", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        dry_run: "yes",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "dry_run: Invalid input: expected boolean, received string",
      );
    }
  });

  it("should handle all valid optional fields", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        ref: "develop",
        repo_base_dir: "/home/user/repos",
        repo_dir: "my-repo",
        patches_dir: "./patches",
        verbose: false,
        dry_run: false,
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        repo_url: "https://github.com/user/repo.git",
        ref: "develop",
        repo_base_dir: "/home/user/repos",
        repo_dir: "my-repo",
        patches_dir: "./patches",
        verbose: false,
        dry_run: false,
      });
    }
  });

  it("should handle JSON parsing errors", () => {
    const result = parseOptionalJsonConfig("{ invalid json");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("JSON parse error");
      expect(result.error).toContain("invalid json");
    }
  });

  it("should handle null values as invalid types", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: null,
        verbose: null,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "repo_url: Invalid input: expected string, received null",
      );
      expect(result.error).toContain(
        "verbose: Invalid input: expected boolean, received null",
      );
    }
  });
});
