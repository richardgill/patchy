import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { isPathWithinDir, resolvePath } from "./fs";

describe("resolvePath", () => {
  const homeDir = os.homedir();

  it("should expand ~ to home directory", () => {
    const result = resolvePath("/project", "~/code/test");
    expect(result).toBe(path.join(homeDir, "code/test"));
  });

  it("should expand standalone ~", () => {
    const result = resolvePath("/project", "~");
    expect(result).toBe(homeDir);
  });

  it("should resolve relative paths normally", () => {
    const result = resolvePath("/project", "./clones");
    expect(result).toBe("/project/clones");
  });

  it("should resolve absolute paths normally", () => {
    const result = resolvePath("/project", "/tmp/clones");
    expect(result).toBe("/tmp/clones");
  });

  it("should handle paths without tilde", () => {
    const result = resolvePath("/project", "some/path");
    expect(result).toBe("/project/some/path");
  });
});

describe("isPathWithinDir", () => {
  const homeDir = os.homedir();

  it("should return true for relative paths within dir", () => {
    expect(isPathWithinDir("/project", "./clones")).toBe(true);
    expect(isPathWithinDir("/project", "clones")).toBe(true);
  });

  it("should return false for paths starting with ..", () => {
    expect(isPathWithinDir("/project", "../outside")).toBe(false);
  });

  it("should return false for absolute paths outside dir", () => {
    expect(isPathWithinDir("/project", "/tmp/clones")).toBe(false);
  });

  it("should return false for tilde paths (outside project)", () => {
    // ~/code/test expands to home directory which is outside /project
    expect(isPathWithinDir("/project", "~/code/test")).toBe(false);
  });

  it("should return true if tilde path happens to be within project", () => {
    // If project is within home and path is also within project
    const projectInHome = path.join(homeDir, "myproject");
    expect(isPathWithinDir(projectInHome, "~/myproject/clones")).toBe(true);
  });

  it("should return false for same directory", () => {
    expect(isPathWithinDir("/project", ".")).toBe(false);
  });
});
