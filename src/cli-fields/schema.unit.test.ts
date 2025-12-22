import { describe, expect, it } from "bun:test";
import { jsonConfigSchema } from "./schema";

describe("jsonConfigSchema", () => {
  const stringFieldTestCases = [
    { field: "base_revision", validValues: ["v1.0.0", "abc123def456789", ""] },
    {
      field: "upstream_branch",
      validValues: ["main", "feature/new-branch", ""],
    },
  ] as const;

  stringFieldTestCases.forEach(({ field, validValues }) => {
    describe(`${field} field`, () => {
      validValues.forEach((value) => {
        it(`should accept "${value}"`, () => {
          const result = jsonConfigSchema.safeParse({ [field]: value });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data[field]).toBe(value);
          }
        });
      });

      const invalidValues = [
        { value: 123, desc: "non-string" },
        { value: ["value"], desc: "array" },
        { value: null, desc: "null" },
      ];

      invalidValues.forEach(({ value, desc }) => {
        it(`should reject ${desc} value`, () => {
          const result = jsonConfigSchema.safeParse({ [field]: value });
          expect(result.success).toBe(false);
        });
      });

      it("should accept undefined (optional field)", () => {
        const result = jsonConfigSchema.safeParse({
          source_repo: "https://github.com/example/repo",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBeUndefined();
        }
      });
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
        ref: "main",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Unrecognized key");
      }
    });
  });
});
