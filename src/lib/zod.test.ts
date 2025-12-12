import { describe, expect, it } from "bun:test";
import { type ZodSchema, z } from "zod";
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

  const testCases: Array<{
    name: string;
    schema: ZodSchema;
    input: unknown;
    expected: string;
  }> = [
    {
      name: "single error with path",
      schema: testSchema,
      input: { name: "test", age: "not a number", active: true },
      expected: "age: Invalid input: expected number, received string",
    },
    {
      name: "multiple errors",
      schema: testSchema,
      input: { name: 123, age: "not a number", active: "yes" },
      expected: [
        "name: Invalid input: expected string, received number",
        "age: Invalid input: expected number, received string",
        "active: Invalid input: expected boolean, received string",
      ].join("\n"),
    },
    {
      name: "nested path errors",
      schema: nestedSchema,
      input: { user: { profile: { email: "invalid" } } },
      expected: "user.profile.email: Invalid email address",
    },
    {
      name: "errors without path",
      schema: z.string().min(5),
      input: "hi",
      expected: "Too small: expected string to have >=5 characters",
    },
    {
      name: "custom error messages",
      schema: z.object({ email: z.string().min(1, "Email is required") }),
      input: { email: "" },
      expected: "email: Email is required",
    },
    {
      name: "array index paths",
      schema: z.object({ items: z.array(z.string()) }),
      input: { items: ["valid", 123, "also valid"] },
      expected: "items.1: Invalid input: expected string, received number",
    },
    {
      name: "union type errors",
      schema: z.union([z.string(), z.number()]),
      input: true,
      expected: "Invalid input",
    },
  ];

  for (const { name, schema, input, expected } of testCases) {
    it(`should format ${name}`, () => {
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(formatZodErrorHuman(result.error)).toBe(expected);
      }
    });
  }

  it("should return error.message when issues array is empty", () => {
    const emptyError = new z.ZodError([]);
    expect(formatZodErrorHuman(emptyError)).toBe("[]");
  });
});
