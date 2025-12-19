import { describe, expect, it } from "bun:test";
import { jsonConfigSchema } from "./schema";

describe("jsonConfigSchema", () => {
  describe("base_revision field", () => {
    it("should accept valid string value", () => {
      const result = jsonConfigSchema.safeParse({
        base_revision: "v1.0.0",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base_revision).toBe("v1.0.0");
      }
    });

    it("should accept SHA value", () => {
      const sha = "abc123def456789";
      const result = jsonConfigSchema.safeParse({
        base_revision: sha,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base_revision).toBe(sha);
      }
    });

    it("should reject non-string value", () => {
      const result = jsonConfigSchema.safeParse({
        base_revision: 123,
      });
      expect(result.success).toBe(false);
    });

    it("should reject array value", () => {
      const result = jsonConfigSchema.safeParse({
        base_revision: ["v1.0.0"],
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty string", () => {
      const result = jsonConfigSchema.safeParse({
        base_revision: "",
      });
      expect(result.success).toBe(true);
    });

    it("should accept undefined (optional field)", () => {
      const result = jsonConfigSchema.safeParse({
        source_repo: "https://github.com/example/repo",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base_revision).toBeUndefined();
      }
    });
  });

  describe("upstream_branch field", () => {
    it("should accept valid string value", () => {
      const result = jsonConfigSchema.safeParse({
        upstream_branch: "main",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.upstream_branch).toBe("main");
      }
    });

    it("should accept branch with slashes", () => {
      const result = jsonConfigSchema.safeParse({
        upstream_branch: "feature/new-branch",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.upstream_branch).toBe("feature/new-branch");
      }
    });

    it("should reject non-string value", () => {
      const result = jsonConfigSchema.safeParse({
        upstream_branch: 123,
      });
      expect(result.success).toBe(false);
    });

    it("should reject null value", () => {
      const result = jsonConfigSchema.safeParse({
        upstream_branch: null,
      });
      expect(result.success).toBe(false);
    });

    it("should accept empty string", () => {
      const result = jsonConfigSchema.safeParse({
        upstream_branch: "",
      });
      expect(result.success).toBe(true);
    });

    it("should accept undefined (optional field)", () => {
      const result = jsonConfigSchema.safeParse({
        source_repo: "https://github.com/example/repo",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.upstream_branch).toBeUndefined();
      }
    });
  });

  describe("combined fields", () => {
    it("should accept both base_revision and upstream_branch together", () => {
      const result = jsonConfigSchema.safeParse({
        source_repo: "https://github.com/example/repo",
        base_revision: "v1.0.0",
        upstream_branch: "main",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base_revision).toBe("v1.0.0");
        expect(result.data.upstream_branch).toBe("main");
      }
    });

    it("should reject unrecognized fields (strict mode)", () => {
      const result = jsonConfigSchema.safeParse({
        base_revision: "v1.0.0",
        ref: "main", // old field name - should be rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Unrecognized key");
      }
    });
  });
});
