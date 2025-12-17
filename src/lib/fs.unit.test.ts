import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path, { join } from "node:path";
import { generateTmpDir } from "~/testing/fs-test-utils";
import {
  findAvailableDirName,
  formatPathForDisplay,
  getSortedFolders,
  isAbsolutePath,
  isPathWithinDir,
  resolvePath,
} from "./fs";

describe("findAvailableDirName", () => {
  const testCases: {
    description: string;
    existingDirs: string[];
    baseName: string;
    expected: string;
  }[] = [
    {
      description: "returns baseName when no existing dirs in parent",
      existingDirs: [],
      baseName: "nix",
      expected: "nix",
    },
    {
      description: "returns baseName when no conflict",
      existingDirs: ["other"],
      baseName: "nix",
      expected: "nix",
    },
    {
      description: "returns baseName-1 when baseName exists",
      existingDirs: ["nix"],
      baseName: "nix",
      expected: "nix-1",
    },
    {
      description: "returns baseName-2 when baseName and baseName-1 exist",
      existingDirs: ["nix", "nix-1"],
      baseName: "nix",
      expected: "nix-2",
    },
    {
      description: "skips to next available number",
      existingDirs: ["nix", "nix-1", "nix-2", "nix-3"],
      baseName: "nix",
      expected: "nix-4",
    },
    {
      description: "increments past gaps in numbering",
      existingDirs: ["nix", "nix-2"],
      baseName: "nix",
      expected: "nix-3",
    },
    {
      description: "works with hyphenated base names",
      existingDirs: ["my-repo"],
      baseName: "my-repo",
      expected: "my-repo-1",
    },
  ];

  testCases.forEach(({ description, existingDirs, baseName, expected }) => {
    it(description, () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });

      existingDirs.forEach((dir) => {
        mkdirSync(join(tmpDir, dir), { recursive: true });
      });

      expect(findAvailableDirName(tmpDir, baseName)).toBe(expected);
    });
  });

  it("returns baseName when parent dir does not exist", () => {
    const tmpDir = generateTmpDir();
    const nonExistentDir = join(tmpDir, "does-not-exist");
    expect(findAvailableDirName(nonExistentDir, "repo")).toBe("repo");
  });
});

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

describe("isAbsolutePath", () => {
  it("should return true for absolute paths", () => {
    expect(isAbsolutePath("/tmp/repo")).toBe(true);
    expect(isAbsolutePath("/home/user/repo")).toBe(true);
  });

  it("should return true for tilde paths", () => {
    expect(isAbsolutePath("~/repo")).toBe(true);
    expect(isAbsolutePath("~/code/my-project")).toBe(true);
  });

  it("should return false for relative paths", () => {
    expect(isAbsolutePath("repo")).toBe(false);
    expect(isAbsolutePath("./repo")).toBe(false);
    expect(isAbsolutePath("../repo")).toBe(false);
    expect(isAbsolutePath("some/nested/repo")).toBe(false);
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

describe("formatPathForDisplay", () => {
  const testCases: { input: string; expected: string }[] = [
    { input: "~/code/test", expected: "~/code/test" },
    { input: "~", expected: "~" },
    { input: "/home/user/code", expected: "/home/user/code" },
    { input: "/tmp/clones", expected: "/tmp/clones" },
    { input: "clones", expected: "./clones" },
    { input: "foo/bar", expected: "./foo/bar" },
    { input: "./already-relative", expected: "./already-relative" },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`formats "${input}" as "${expected}"`, () => {
      expect(formatPathForDisplay(input)).toBe(expected);
    });
  });
});

describe("getSortedFolders", () => {
  it("returns empty array for non-existent directory", () => {
    expect(getSortedFolders("/non/existent")).toEqual([]);
  });

  it("returns sorted directory names", () => {
    const tmpDir = generateTmpDir();
    mkdirSync(join(tmpDir, "002-second"), { recursive: true });
    mkdirSync(join(tmpDir, "001-first"), { recursive: true });
    writeFileSync(join(tmpDir, "not-a-dir.txt"), "file");

    expect(getSortedFolders(tmpDir)).toEqual(["001-first", "002-second"]);
  });

  it("returns empty array for empty directory", () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });

    expect(getSortedFolders(tmpDir)).toEqual([]);
  });
});
