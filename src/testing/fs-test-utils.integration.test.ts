import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stabilizeTempDir, writeTestConfig } from "~/testing/fs-test-utils";

describe("fs-test-utils", () => {
  describe("writeTestConfig", () => {
    it("should generate JSON content correctly", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "test-utils-"));
      const configPath = join(tempDir, "test-config.json");

      await writeTestConfig(configPath, {
        source_repo: "https://github.com/example/repo.git",
        target_repo: "main",
        clones_dir: "/tmp/repos",
        patches_dir: "patches",
        ref: "main",
        verbose: true,
        dry_run: false,
      });

      const jsonContent = readFileSync(configPath, "utf-8");

      expect(jsonContent).toMatchInlineSnapshot(`
        "{
          "source_repo": "https://github.com/example/repo.git",
          "target_repo": "main",
          "clones_dir": "/tmp/repos",
          "patches_dir": "patches",
          "ref": "main",
          "verbose": true,
          "dry_run": false
        }"
      `);

      rmSync(tempDir, { recursive: true });
    });
  });

  describe("stabilizeTempDir", () => {
    it("should replace temp directory paths", () => {
      const input = "/any/path/to/tmp/test-abc123-def456/repos";
      expect(stabilizeTempDir(input)).toBe("<TEST_DIR>/repos");
    });

    it("should handle multiple temp paths in text", () => {
      const input = `Configuration:
        path1: /Users/john/code/patchy-test/e2e/tmp/test-123-456/repos
        path2: /home/user/projects/tmp/test-789-abc/data`;

      const expected = `Configuration:
        path1: <TEST_DIR>/repos
        path2: <TEST_DIR>/data`;

      expect(stabilizeTempDir(input)).toBe(expected);
    });

    it("should handle relative temp paths", () => {
      const input = "e2e/tmp/test-abc123-def456/repos/main";
      expect(stabilizeTempDir(input)).toBe("<TEST_DIR>/repos/main");
    });
  });
});
