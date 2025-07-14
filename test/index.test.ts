import { describe, expect, it } from "vitest";
import { capitalizeFirstLetter } from "../src/index";

describe("capitalizeFirstLetter", () => {
  it("should capitalize the first letter of a string", () => {
    expect(capitalizeFirstLetter("hello")).toBe("Hello");
  });

  it("should return an empty string if input is empty", () => {
    expect(capitalizeFirstLetter("")).toBe("");
  });

  it("should handle single character strings", () => {
    expect(capitalizeFirstLetter("a")).toBe("A");
  });

  it("should not change the rest of the string", () => {
    expect(capitalizeFirstLetter("hello world")).toBe("Hello world");
  });
});
