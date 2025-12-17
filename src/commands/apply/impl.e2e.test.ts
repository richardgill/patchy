import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runCli } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeFileIn,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/fs-test-utils";
import { initGitRepoWithCommit } from "~/testing/git-helpers";

describe("patchy apply", () => {
  describe("config validation", () => {
    it("should fail when required fields are missing", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          patchesDir: "patches",
        },
        jsonConfig: {
          verbose: true,
        },
      });

      const result = await runCli(`patchy apply --dry-run`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "Missing required parameters:

          Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

        You can set up ./patchy.json by running:
          patchy init"
      `);
    });

    it("should fail when config file doesn't exist with explicit path", async () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });

      const result = await runCli(
        `patchy apply --config ./non-existent-config.json`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Configuration file not found: <TEST_DIR>/non-existent-config.json"`,
      );
    });

    it("should fail on invalid JSON syntax", async () => {
      const tmpDir = generateTmpDir();
      await writeTestFile(tmpDir, "invalid.json", "{ invalid json: content }");

      const result = await runCli(`patchy apply --config invalid.json`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "JSON parse error: InvalidSymbol

        >    1 | { invalid json: content }
                  ^"
      `);
    });

    it("should fail validation when directories don't exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
        jsonConfig: {
          source_repo: "https://github.com/example/repo.git",
          clones_dir: "non-existent-base",
          target_repo: "non-existent-repo",
          patches_dir: "non-existent-patches",
        },
      });

      const result = await runCli(`patchy apply`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "Validation errors:

        clones_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
        patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches"
      `);
    });

    it("should handle invalid JSON structure", async () => {
      const tmpDir = generateTmpDir();
      await writeJsonConfig(tmpDir, "invalid-structure.json", {
        source_repo: 123,
        verbose: "not-a-boolean",
        ref: ["array", "not", "string"],
      });

      const result = await runCli(
        `patchy apply --config invalid-structure.json`,
        tmpDir,
      );

      expect(result).toFailWith("Invalid input");
    });

    it("should handle Zod strict mode error for unknown fields", async () => {
      const tmpDir = generateTmpDir();
      await writeJsonConfig(tmpDir, "unknown-fields.json", {
        source_repo: "https://github.com/user/repo.git",
        unknown_field: "value",
        another_unknown: 123,
      });

      const result = await runCli(
        `patchy apply --config unknown-fields.json`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Unrecognized keys: "unknown_field", "another_unknown""`,
      );
    });
  });

  describe("empty patches directory", () => {
    it("should report no patch sets found when patches dir is empty", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          patchesDir: "patches",
          clonesDir: "repos",
          targetRepo: "main",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const result = await runCli(`patchy apply`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`"No patch sets found."`);
    });

    it("should report no patch sets found in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          patchesDir: "patches",
          clonesDir: "repos",
          targetRepo: "main",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const result = await runCli(`patchy apply --dry-run`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`"No patch sets found."`);
    });
  });

  describe("applying patch sets", () => {
    it("should apply all patch sets in alphabetical order", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(patchesDir, "001-first/file1.ts", "content from first");
      await writeFileIn(
        patchesDir,
        "002-second/file2.ts",
        "content from second",
      );
      await writeFileIn(patchesDir, "003-third/file3.ts", "content from third");

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "Applying patch sets...
          [001-first] 1 file(s)
            Copied: file1.ts
          [002-second] 1 file(s)
            Copied: file2.ts
          [003-third] 1 file(s)
            Copied: file3.ts
        Successfully applied 3 patch file(s) across 3 patch set(s)."
      `);

      expect(path.join(repoDir, "file1.ts")).toHaveFileContent(
        "content from first",
      );
      expect(path.join(repoDir, "file2.ts")).toHaveFileContent(
        "content from second",
      );
      expect(path.join(repoDir, "file3.ts")).toHaveFileContent(
        "content from third",
      );
    });

    it("should apply single patch set with --only flag", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(patchesDir, "001-first/file1.ts", "content from first");
      await writeFileIn(
        patchesDir,
        "002-second/file2.ts",
        "content from second",
      );
      await writeFileIn(patchesDir, "003-third/file3.ts", "content from third");

      const result = await runCli(
        `patchy apply --only 002-second --verbose`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "Applying patch sets...
          [002-second] 1 file(s)
            Copied: file2.ts
        Successfully applied 1 patch file(s) across 1 patch set(s)."
      `);

      expect(path.join(repoDir, "file1.ts")).not.toExist();
      expect(path.join(repoDir, "file2.ts")).toHaveFileContent(
        "content from second",
      );
      expect(path.join(repoDir, "file3.ts")).not.toExist();
    });

    it("should apply patch sets up to and including --until", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(patchesDir, "001-first/file1.ts", "content from first");
      await writeFileIn(
        patchesDir,
        "002-second/file2.ts",
        "content from second",
      );
      await writeFileIn(patchesDir, "003-third/file3.ts", "content from third");

      const result = await runCli(
        `patchy apply --until 002-second --verbose`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "Applying patch sets...
          [001-first] 1 file(s)
            Copied: file1.ts
          [002-second] 1 file(s)
            Copied: file2.ts
        Successfully applied 2 patch file(s) across 2 patch set(s)."
      `);

      expect(path.join(repoDir, "file1.ts")).toHaveFileContent(
        "content from first",
      );
      expect(path.join(repoDir, "file2.ts")).toHaveFileContent(
        "content from second",
      );
      expect(path.join(repoDir, "file3.ts")).not.toExist();
    });

    it("should fail when --only patch set does not exist", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      await writeFileIn(patchesDir, "001-first/file1.ts", "content");

      const result = await runCli(
        `patchy apply --only non-existent-set`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Patch set not found: non-existent-set"`,
      );
    });

    it("should fail when --until patch set does not exist", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      await writeFileIn(patchesDir, "001-first/file1.ts", "content");

      const result = await runCli(
        `patchy apply --until non-existent-set`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Patch set not found: non-existent-set"`,
      );
    });

    it("should fail when both --only and --until are provided", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      await writeFileIn(patchesDir, "001-first/file1.ts", "content");
      await writeFileIn(patchesDir, "002-second/file2.ts", "content");

      const result = await runCli(
        `patchy apply --only 001-first --until 002-second`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Cannot use both --only and --until flags together"`,
      );
    });
  });

  describe("file operations", () => {
    it("should copy new files from patch set to repo", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(
        patchesDir,
        "001-my-set/newFile.ts",
        'export const hello = "world";',
      );

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[001-my-set] 1 file(s)");
      expect(result).toHaveOutput("Copied: newFile.ts");

      expect(path.join(repoDir, "newFile.ts")).toHaveFileContent(
        'export const hello = "world";',
      );
    });

    it("should copy new files in nested directories", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(
        patchesDir,
        "001-my-set/src/utils/helper.ts",
        "export const add = (a: number, b: number) => a + b;",
      );

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Copied: src/utils/helper.ts");

      expect(path.join(repoDir, "src", "utils", "helper.ts")).toHaveFileContent(
        "export const add = (a: number, b: number) => a + b;",
      );
    });

    it("should apply diff files to existing files", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(
        repoDir,
        "existing.ts",
        "const value = 1;\nconst other = 2;\n",
      );

      await writeFileIn(
        patchesDir,
        "001-my-set/existing.ts.diff",
        `--- a/existing.ts
+++ b/existing.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`,
      );

      const targetFile = path.join(repoDir, "existing.ts");

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Applied diff: existing.ts.diff");

      expect(targetFile).toHaveFileContent(
        "const value = 42;\nconst other = 2;\n",
      );
    });

    it("should handle mixed files (copies and diffs) in a patch set", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(repoDir, "existing.ts", "const x = 1;\n");
      await writeFileIn(patchesDir, "001-my-set/new.ts", "export const y = 2;");
      await writeFileIn(
        patchesDir,
        "001-my-set/existing.ts.diff",
        `--- a/existing.ts
+++ b/existing.ts
@@ -1 +1 @@
-const x = 1;
+const x = 100;
`,
      );

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[001-my-set] 2 file(s)");

      expect(path.join(repoDir, "existing.ts")).toHaveFileContent(
        "const x = 100;\n",
      );
      expect(path.join(repoDir, "new.ts")).toHaveFileContent(
        "export const y = 2;",
      );
    });

    it("should report error when diff target file does not exist", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;

      await writeFileIn(
        patchesDir,
        "001-my-set/missing.ts.diff",
        `--- a/missing.ts
+++ b/missing.ts
@@ -1 +1 @@
-old
+new
`,
      );

      const result = await runCli(`patchy apply`, tmpDir);

      expect(result).toFailWith("Errors occurred while applying patches:");
      expect(result.stderr).toContain(
        "missing.ts.diff: Target file does not exist",
      );
    });

    it("should preserve file content when copying", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const complexContent = `import { foo } from "bar";

export const component = () => {
  return <div>Hello</div>;
};

// Special characters: "quotes", 'single', \`backticks\`
// Unicode: 你好 🎉
`;
      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(patchesDir, "001-my-set/complex.tsx", complexContent);

      const result = await runCli(`patchy apply`, tmpDir);

      expect(result).toSucceed();
      expect(path.join(repoDir, "complex.tsx")).toHaveFileContent(
        complexContent,
      );
    });
  });

  describe("dry run", () => {
    it("should list what would be done in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(patchesDir, "001-my-set/newFile.ts", "content");
      await writeFileIn(patchesDir, "001-my-set/existing.ts.diff", "diff");

      const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("[001-my-set] 2 file(s)");
      expect(result).toHaveOutput("Apply diff: existing.ts.diff");
      expect(result).toHaveOutput("Copy: newFile.ts");

      expect(path.join(repoDir, "newFile.ts")).not.toExist();
    });

    it("should show dry-run output for multiple patch sets", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;

      await writeFileIn(patchesDir, "001-first/file1.ts", "content1");
      await writeFileIn(patchesDir, "002-second/file2.ts", "content2");

      const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "[DRY RUN] Would apply patches from ./patches/ to ./main
        Applying patch sets...
          [001-first] 1 file(s)
            Copy: file1.ts
          [002-second] 1 file(s)
            Copy: file2.ts
        Successfully applied 2 patch file(s) across 2 patch set(s)."
      `);
    });
  });

  describe("fuzz factor", () => {
    it("should apply diff with fuzzy matching when context lines are missing", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(
        repoDir,
        "fuzzy.ts",
        `const value = 1;
const other = 2;
`,
      );

      await writeFileIn(
        patchesDir,
        "001-my-set/fuzzy.ts.diff",
        `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
      );

      const result = await runCli(`patchy apply --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Applied diff: fuzzy.ts.diff");

      expect(path.join(repoDir, "fuzzy.ts")).toHaveFileContent(
        `const value = 42;
const other = 2;
`,
      );
    });

    it("should fail when fuzz-factor is 0 and context lines are missing", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
          patchesDir: "patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      const repoDir = ctx.absoluteTargetRepo as string;

      await writeFileIn(
        repoDir,
        "fuzzy.ts",
        `const value = 1;
const other = 2;
`,
      );

      await writeFileIn(
        patchesDir,
        "001-my-set/fuzzy.ts.diff",
        `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
      );

      const result = await runCli(`patchy apply --fuzz-factor 0`, tmpDir);

      expect(result).toFailWith("Errors occurred while applying patches:");
      expect(result.stderr).toContain("Patch failed to apply");
    });
  });

  describe("absolute paths", () => {
    it("should work with absolute target_repo without clones_dir", async () => {
      const tmpDir = generateTmpDir();

      const absoluteRepoPath = path.join(tmpDir, "standalone-repo");
      mkdirSync(absoluteRepoPath, { recursive: true });
      await initGitRepoWithCommit(
        absoluteRepoPath,
        "file.txt",
        "original content",
      );

      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: { patchesDir: "patches" },
        jsonConfig: {
          target_repo: absoluteRepoPath,
          patches_dir: "./patches",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      await writeFileIn(
        patchesDir,
        "001-my-set/file.txt.diff",
        `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-original content
+patched content
`,
      );

      const result = await runCli(`patchy apply`, tmpDir);

      expect(result).toSucceed();
      expect(path.join(absoluteRepoPath, "file.txt")).toHaveFileContent(
        "patched content",
      );
    });

    it("should handle absolute paths in config", async () => {
      const tmpDir = generateTmpDir();
      const absoluteBase = path.join(tmpDir, "absolute-base");
      const absolutePatches = path.join(tmpDir, "absolute-patches");

      await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "absolute-base",
          targetRepo: "repo",
          patchesDir: "absolute-patches",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/repo.git",
          clones_dir: absoluteBase,
          target_repo: "repo",
          patches_dir: absolutePatches,
        },
      });

      const result = await runCli(`patchy apply --dry-run`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`"No patch sets found."`);
    });
  });

  describe("config override", () => {
    it("should override config file values with CLI flags", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          patchesDir: "cli-patches",
          clonesDir: "repos",
          targetRepo: "cli-repo",
        },
        jsonConfig: {
          source_repo: "https://github.com/example/test-repo.git",
          target_repo: "config-repo",
          clones_dir: `${tmpDir}/repos`,
          patches_dir: "config-patches",
          ref: "main",
        },
      });

      const patchesDir = ctx.absolutePatchesDir as string;
      await writeFileIn(patchesDir, "001-my-set/file.ts", "content");

      const result = await runCli(
        `patchy apply --target-repo cli-repo --patches-dir cli-patches --config patchy.json --dry-run --verbose`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput(
        "[DRY RUN] Would apply patches from ./cli-patches to ./cli-repo",
      );
    });
  });
});
