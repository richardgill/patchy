import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateTmpDir } from "~/testing/test-utils";
import { findAvailableDirName } from "./fs";

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
      description: "fills gaps in numbering",
      existingDirs: ["nix", "nix-2"],
      baseName: "nix",
      expected: "nix-1",
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
