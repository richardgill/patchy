import { describe, expect, it } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateTmpDir } from "~/testing/fs-test-utils";
import {
  findHook,
  getHookFilename,
  getHookFilenames,
  isExecutable,
  validateHookPermissions,
} from "./hooks";

describe("getHookFilename", () => {
  const testCases = [
    { prefix: "patchy-", type: "pre-apply", expected: "patchy-pre-apply" },
    { prefix: "patchy-", type: "post-apply", expected: "patchy-post-apply" },
    { prefix: "_", type: "pre-apply", expected: "_pre-apply" },
    { prefix: "hook.", type: "post-apply", expected: "hook.post-apply" },
  ] as const;

  testCases.forEach(({ prefix, type, expected }) => {
    it(`should return "${expected}" for prefix "${prefix}" and type "${type}"`, () => {
      expect(getHookFilename(prefix, type)).toBe(expected);
    });
  });
});

describe("getHookFilenames", () => {
  it("should return both hook filenames", () => {
    expect(getHookFilenames("patchy-")).toEqual([
      "patchy-pre-apply",
      "patchy-post-apply",
    ]);
  });
});

describe("findHook", () => {
  it("should return undefined when hook does not exist", () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });

    const result = findHook({
      dir: tmpDir,
      prefix: "patchy-",
      type: "pre-apply",
    });
    expect(result).toBeUndefined();
  });

  it("should return hook info when hook exists", () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    const hookPath = join(tmpDir, "patchy-pre-apply");
    writeFileSync(hookPath, "#!/bin/bash\necho test");

    const result = findHook({
      dir: tmpDir,
      prefix: "patchy-",
      type: "pre-apply",
    });

    expect(result).toEqual({
      path: hookPath,
      name: "patchy-pre-apply",
      type: "pre-apply",
    });
  });
});

describe("isExecutable", () => {
  it("should return false for non-existent file", () => {
    expect(isExecutable("/nonexistent/path")).toBe(false);
  });

  const testCases = [
    { mode: 0o644, expected: false, desc: "non-executable" },
    { mode: 0o755, expected: true, desc: "executable" },
  ] as const;

  testCases.forEach(({ mode, expected, desc }) => {
    it(`should return ${expected} for ${desc} file`, () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });
      const filePath = join(tmpDir, "test-file");
      writeFileSync(filePath, "#!/bin/bash\necho test");
      chmodSync(filePath, mode);

      expect(isExecutable(filePath)).toBe(expected);
    });
  });
});

describe("validateHookPermissions", () => {
  const testCases = [
    {
      mode: 0o755,
      expected: { success: true },
      desc: "executable hook",
    },
    {
      mode: 0o644,
      expected: {
        success: false,
        error:
          "Hook 'patchy-pre-apply' in patch set '001-test' is not executable.\n" +
          "Run: chmod +x patches/001-test/patchy-pre-apply",
      },
      desc: "non-executable hook",
    },
  ] as const;

  testCases.forEach(({ mode, expected, desc }) => {
    it(`should return ${expected.success ? "success" : "error"} for ${desc}`, () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });
      const hookPath = join(tmpDir, "patchy-pre-apply");
      writeFileSync(hookPath, "#!/bin/bash\necho test");
      chmodSync(hookPath, mode);

      const result = validateHookPermissions({
        hook: { path: hookPath, name: "patchy-pre-apply", type: "pre-apply" },
        patchSetName: "001-test",
        patchSetDir: "patches/001-test",
      });

      expect(result).toEqual(expected);
    });
  });
});
