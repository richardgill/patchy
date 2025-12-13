import { describe, expect, it } from "bun:test";
import {
  isValidGitUrl,
  validateGitUrl,
  validatePath,
  validateRef,
} from "./validation";

describe("isValidGitUrl", () => {
  const validUrls = [
    "https://github.com/user/repo.git",
    "https://github.com/user/repo",
    "https://gitlab.com/group/subgroup/repo.git",
    "http://github.com/user/repo",
    "git@github.com:user/repo.git",
    "git@github.com:user/repo",
    "git@gitlab.com:org/my-repo.git",
    "file:///path/to/repo.git",
    "file:///home/user/repos/my-repo",
    "file:///tmp/test-repo.git",
  ];

  validUrls.forEach((url) => {
    it(`accepts valid URL: ${url}`, () => {
      expect(isValidGitUrl(url)).toBe(true);
    });
  });

  const invalidUrls = [
    "",
    "   ",
    "not-a-url",
    "github.com/user/repo",
    "ftp://github.com/user/repo",
    "file://",
    "file:///",
    "https://",
    "git@",
  ];

  invalidUrls.forEach((url) => {
    it(`rejects invalid URL: "${url}"`, () => {
      expect(isValidGitUrl(url)).toBe(false);
    });
  });

  it("trims whitespace from URLs", () => {
    expect(isValidGitUrl("  https://github.com/user/repo  ")).toBe(true);
  });
});

describe("validateGitUrl", () => {
  it("returns true for valid URLs", () => {
    expect(validateGitUrl("https://github.com/user/repo")).toBe(true);
    expect(validateGitUrl("file:///path/to/repo")).toBe(true);
  });

  it("returns error message for empty URL", () => {
    expect(validateGitUrl("")).toBe("Repository URL is required");
    expect(validateGitUrl("   ")).toBe("Repository URL is required");
  });

  it("returns error message for invalid URL", () => {
    const result = validateGitUrl("not-a-url");
    expect(typeof result).toBe("string");
    expect(result).toContain("valid Git URL");
  });
});

describe("validatePath", () => {
  it("returns true for valid paths", () => {
    expect(validatePath("/path/to/dir", "Directory")).toBe(true);
    expect(validatePath("relative/path", "Path")).toBe(true);
  });

  it("returns error message for empty path", () => {
    expect(validatePath("", "Directory")).toBe("Directory is required");
    expect(validatePath("   ", "Path")).toBe("Path is required");
  });
});

describe("validateRef", () => {
  it("returns true for valid refs", () => {
    expect(validateRef("main")).toBe(true);
    expect(validateRef("v1.0.0")).toBe(true);
    expect(validateRef("feature/branch")).toBe(true);
  });

  it("returns error message for empty ref", () => {
    expect(validateRef("")).toBe("Git ref is required");
    expect(validateRef("   ")).toBe("Git ref is required");
  });
});
