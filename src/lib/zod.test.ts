import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { formatZodErrorHuman } from "./zod";

describe("formatZodErrorHuman", () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean(),
  });

  const nestedSchema = z.object({
    user: z.object({
      profile: z.object({
        email: z.string().email(),
      }),
    }),
  });

  it("should format a single error with path", () => {
    const result = testSchema.safeParse({
      name: "test",
      age: "not a number",
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"age: Invalid input: expected number, received string"`,
      );
    }
  });

  it("should format multiple errors", () => {
    const result = testSchema.safeParse({
      name: 123,
      age: "not a number",
      active: "yes",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(`
        "name: Invalid input: expected string, received number
        age: Invalid input: expected number, received string
        active: Invalid input: expected boolean, received string"
      `);
    }
  });

  it("should format nested path errors", () => {
    const result = nestedSchema.safeParse({
      user: { profile: { email: "invalid" } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"user.profile.email: Invalid email address"`,
      );
    }
  });

  it("should handle errors without path", () => {
    const schema = z.string().min(5);
    const result = schema.safeParse("hi");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"Too small: expected string to have >=5 characters"`,
      );
    }
  });

  it("should handle custom error messages", () => {
    const schema = z.object({
      email: z.string().min(1, "Email is required"),
    });
    const result = schema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"email: Email is required"`,
      );
    }
  });

  it("should handle array index paths", () => {
    const schema = z.object({
      items: z.array(z.string()),
    });
    const result = schema.safeParse({ items: ["valid", 123, "also valid"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"items.1: Invalid input: expected string, received number"`,
      );
    }
  });

  it("should handle union type errors", () => {
    const schema = z.union([z.string(), z.number()]);
    const result = schema.safeParse(true);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorHuman(result.error)).toMatchInlineSnapshot(
        `"Invalid input"`,
      );
    }
  });

  it("should return error.message when issues array is empty", () => {
    const emptyError = new z.ZodError([]);
    expect(formatZodErrorHuman(emptyError)).toBe("[]");
  });
});
