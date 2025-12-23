import { describe, expect, it } from "bun:test";
import { isLocalPath, isValidGitUrl, validateGitUrl } from "./validation";

describe("isValidGitUrl", () => {
  const validUrls = [
    // HTTPS URLs
    "https://github.com/user/repo.git",
    "https://github.com/user/repo",
    "https://gitlab.com/group/subgroup/repo.git",
    "http://github.com/user/repo",
    // SSH URLs
    "git@github.com:user/repo.git",
    "git@github.com:user/repo",
    "git@gitlab.com:org/my-repo.git",
    // file:// URLs
    "file:///path/to/repo.git",
    "file:///home/user/repos/my-repo",
    "file:///tmp/test-repo.git",
    // Absolute paths
    "/path/to/repo",
    "/home/user/repos/my-repo.git",
    "/tmp/test-repo",
    // Relative paths
    "./upstream",
    "../sibling-repo",
    "./path/to/repo.git",
    "../parent/repo",
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
    // Invalid local paths
    ".",
    "..",
    "relative",
    "./",
    "../",
    "/",
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

describe("isLocalPath", () => {
  const localPaths = [
    "/absolute/path",
    "/home/user/repo.git",
    "./relative/path",
    "../parent/repo",
    "file:///path/to/repo",
    "file://localhost/path",
  ];

  localPaths.forEach((path) => {
    it(`returns true for local path: ${path}`, () => {
      expect(isLocalPath(path)).toBe(true);
    });
  });

  const remotePaths = [
    "https://github.com/user/repo",
    "git@github.com:user/repo.git",
    "relative-no-prefix",
    "",
    "ftp://server/path",
  ];

  remotePaths.forEach((path) => {
    it(`returns false for non-local path: "${path}"`, () => {
      expect(isLocalPath(path)).toBe(false);
    });
  });

  it("trims whitespace before checking", () => {
    expect(isLocalPath("  /path/to/repo  ")).toBe(true);
    expect(isLocalPath("  ./relative  ")).toBe(true);
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
