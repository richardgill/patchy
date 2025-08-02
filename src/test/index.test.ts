import { describe, expect, it } from "vitest";
import { capitalizeFirstLetter } from "../index";

describe("capitalizeFirstLetter", () => {
  it("should capitalize the first letter of a string", () => {
    expect(capitalizeFirstLetter("hello")).toMatchInlineSnapshot(`"Hello"`);
  });

  it("should return an empty string if input is empty", () => {
    expect(capitalizeFirstLetter("")).toMatchInlineSnapshot(`""`);
  });

  it("should handle single character strings", () => {
    expect(capitalizeFirstLetter("a")).toMatchInlineSnapshot(`"A"`);
  });

  it("should not change the rest of the string", () => {
    expect(capitalizeFirstLetter("hello world")).toMatchInlineSnapshot(
      `"Hello world"`,
    );
  });
});
