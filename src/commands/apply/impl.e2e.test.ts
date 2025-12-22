import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runCli } from "~/testing/e2e-utils";
import { generateTmpDir, setupTestWithConfig } from "~/testing/fs-test-utils";
import { initGitRepoWithCommit } from "~/testing/git-helpers";
import { scenario } from "~/testing/scenario";

describe("patchy apply", () => {
  describe("config validation", () => {
    it("should fail when required fields are missing", async () => {
      const { runCli } = await scenario({
        rawConfig: {
          verbose: true,
        },
      });

      const { result } = await runCli(`patchy apply --dry-run`);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "Missing required parameters:

          Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

        You can set up ./patchy.json by running:
          patchy init"
      `);
    });

    it("should fail when config file doesn't exist with explicit path", async () => {
      const { runCli } = await scenario({ noConfig: true });

      const { result } = await runCli(
        `patchy apply --config ./non-existent-config.json`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Configuration file not found: <TEST_DIR>/non-existent-config.json"`,
      );
    });

    it("should fail on invalid JSON syntax", async () => {
      const { runCli } = await scenario({
        configPath: "invalid.json",
        configContent: "{ invalid json: content }",
      });

      const { result } = await runCli(`patchy apply --config invalid.json`);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "JSON parse error: InvalidSymbol

        >    1 | { invalid json: content }
                  ^"
      `);
    });

    it("should fail validation when directories don't exist", async () => {
      const { runCli } = await scenario({
        rawConfig: {
          source_repo: "https://github.com/example/repo.git",
          clones_dir: "non-existent-base",
          target_repo: "non-existent-repo",
          patches_dir: "non-existent-patches",
        },
      });

      const { result } = await runCli(`patchy apply`);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(`
        "Validation errors:

        clones_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
        patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches"
      `);
    });

    it("should handle invalid JSON structure", async () => {
      const { runCli } = await scenario({
        configPath: "invalid-structure.json",
        rawConfig: {
          source_repo: 123,
          verbose: "not-a-boolean",
          base_revision: ["array", "not", "string"],
        },
      });

      const { result } = await runCli(
        `patchy apply --config invalid-structure.json`,
      );

      expect(result).toFailWith("Invalid input");
    });

    it("should handle Zod strict mode error for unknown fields", async () => {
      const { runCli } = await scenario({
        configPath: "unknown-fields.json",
        rawConfig: {
          source_repo: "https://github.com/user/repo.git",
          unknown_field: "value",
          another_unknown: 123,
        },
      });

      const { result } = await runCli(
        `patchy apply --config unknown-fields.json`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Unrecognized keys: "unknown_field", "another_unknown""`,
      );
    });
  });

  describe("empty patches directory", () => {
    it("should report no patch sets found when patches dir is empty", async () => {
      const { runCli } = await scenario();

      const { result } = await runCli(`patchy apply`);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`"No patch sets found."`);
    });

    it("should report no patch sets found in dry-run mode", async () => {
      const { runCli } = await scenario();

      const { result } = await runCli(`patchy apply --dry-run`);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`"No patch sets found."`);
    });
  });

  describe("applying patch sets", () => {
    it("should apply all patch sets in alphabetical order", async () => {
      const { runCli, files } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content from first" },
          "002-second": { "file2.ts": "content from second" },
          "003-third": { "file3.ts": "content from third" },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

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

      expect(files("file1.ts")).toBe("content from first");
      expect(files("file2.ts")).toBe("content from second");
      expect(files("file3.ts")).toBe("content from third");
    });

    it("should apply single patch set with --only flag", async () => {
      const { runCli, files, exists } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content from first" },
          "002-second": { "file2.ts": "content from second" },
          "003-third": { "file3.ts": "content from third" },
        },
      });

      const { result } = await runCli(
        `patchy apply --only 002-second --verbose`,
      );

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "Applying patch sets...
          [002-second] 1 file(s)
            Copied: file2.ts
        Successfully applied 1 patch file(s) across 1 patch set(s)."
      `);

      expect(exists("file1.ts")).toBe(false);
      expect(files("file2.ts")).toBe("content from second");
      expect(exists("file3.ts")).toBe(false);
    });

    it("should apply patch sets up to and including --until", async () => {
      const { runCli, files, exists } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content from first" },
          "002-second": { "file2.ts": "content from second" },
          "003-third": { "file3.ts": "content from third" },
        },
      });

      const { result } = await runCli(
        `patchy apply --until 002-second --verbose`,
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

      expect(files("file1.ts")).toBe("content from first");
      expect(files("file2.ts")).toBe("content from second");
      expect(exists("file3.ts")).toBe(false);
    });

    it("should fail when --only patch set does not exist", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content" },
        },
      });

      const { result } = await runCli(`patchy apply --only non-existent-set`);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Patch set not found: non-existent-set"`,
      );
    });

    it("should fail when --until patch set does not exist", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content" },
        },
      });

      const { result } = await runCli(`patchy apply --until non-existent-set`);

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Patch set not found: non-existent-set"`,
      );
    });

    it("should fail when both --only and --until are provided", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content" },
          "002-second": { "file2.ts": "content" },
        },
      });

      const { result } = await runCli(
        `patchy apply --only 001-first --until 002-second`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Cannot use both --only and --until flags together"`,
      );
    });
  });

  describe("file operations", () => {
    it("should copy new files from patch set to repo", async () => {
      const { runCli, files } = await scenario({
        patches: {
          "001-my-set": {
            "newFile.ts": 'export const hello = "world";',
          },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[001-my-set] 1 file(s)");
      expect(result).toHaveOutput("Copied: newFile.ts");

      expect(files("newFile.ts")).toBe('export const hello = "world";');
    });

    it("should copy new files in nested directories", async () => {
      const { runCli, files } = await scenario({
        patches: {
          "001-my-set": {
            "src/utils/helper.ts":
              "export const add = (a: number, b: number) => a + b;",
          },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Copied: src/utils/helper.ts");

      expect(files("src/utils/helper.ts")).toBe(
        "export const add = (a: number, b: number) => a + b;",
      );
    });

    it("should apply diff files to existing files", async () => {
      const { runCli, files } = await scenario({
        targetFiles: {
          "existing.ts": "const value = 1;\nconst other = 2;\n",
        },
        patches: {
          "001-my-set": {
            "existing.ts.diff": `--- a/existing.ts
+++ b/existing.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`,
          },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Applied diff: existing.ts.diff");

      expect(files("existing.ts")).toBe(
        "const value = 42;\nconst other = 2;\n",
      );
    });

    it("should handle mixed files (copies and diffs) in a patch set", async () => {
      const { runCli, files } = await scenario({
        targetFiles: {
          "existing.ts": "const x = 1;\n",
        },
        patches: {
          "001-my-set": {
            "new.ts": "export const y = 2;",
            "existing.ts.diff": `--- a/existing.ts
+++ b/existing.ts
@@ -1 +1 @@
-const x = 1;
+const x = 100;
`,
          },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[001-my-set] 2 file(s)");

      expect(files("existing.ts")).toBe("const x = 100;\n");
      expect(files("new.ts")).toBe("export const y = 2;");
    });

    it("should report error when diff target file does not exist", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-my-set": {
            "missing.ts.diff": `--- a/missing.ts
+++ b/missing.ts
@@ -1 +1 @@
-old
+new
`,
          },
        },
      });

      const { result } = await runCli(`patchy apply`);

      expect(result).toFailWith("Errors occurred while applying patches:");
      expect(result.stderr).toContain(
        "missing.ts.diff: Target file does not exist",
      );
    });

    it("should preserve file content when copying", async () => {
      const complexContent = `import { foo } from "bar";

export const component = () => {
  return <div>Hello</div>;
};

// Special characters: "quotes", 'single', \`backticks\`
// Unicode: 你好 🎉
`;
      const { runCli, files } = await scenario({
        patches: {
          "001-my-set": {
            "complex.tsx": complexContent,
          },
        },
      });

      const { result } = await runCli(`patchy apply`);

      expect(result).toSucceed();
      expect(files("complex.tsx")).toBe(complexContent);
    });
  });

  describe("dry run", () => {
    it("should list what would be done in dry-run mode", async () => {
      const { runCli, exists } = await scenario({
        patches: {
          "001-my-set": {
            "newFile.ts": "content",
            "existing.ts.diff": "diff",
          },
        },
      });

      const { result } = await runCli(`patchy apply --dry-run --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("[001-my-set] 2 file(s)");
      expect(result).toHaveOutput("Apply diff: existing.ts.diff");
      expect(result).toHaveOutput("Copy: newFile.ts");

      expect(exists("newFile.ts")).toBe(false);
    });

    it("should show dry-run output for multiple patch sets", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { result } = await runCli(`patchy apply --dry-run --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toMatchInlineSnapshot(`
        "[DRY RUN] Would apply patches from ./patches to ./main
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
      const { runCli, files } = await scenario({
        targetFiles: {
          "fuzzy.ts": `const value = 1;
const other = 2;
`,
        },
        patches: {
          "001-my-set": {
            "fuzzy.ts.diff": `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
          },
        },
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Applied diff: fuzzy.ts.diff");

      expect(files("fuzzy.ts")).toBe(`const value = 42;
const other = 2;
`);
    });

    it("should fail when fuzz-factor is 0 and context lines are missing", async () => {
      const { runCli } = await scenario({
        targetFiles: {
          "fuzzy.ts": `const value = 1;
const other = 2;
`,
        },
        patches: {
          "001-my-set": {
            "fuzzy.ts.diff": `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
          },
        },
      });

      const { result } = await runCli(`patchy apply --fuzz-factor 0`);

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
      const { writeFileIn } = await import("~/testing/fs-test-utils");
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
      const { runCli, tmpDir } = await scenario({
        config: {
          target_repo: "config-repo",
          patches_dir: "config-patches",
          base_revision: "main",
        },
      });

      const { mkdir } = await import("node:fs/promises");
      await mkdir(path.join(tmpDir, "cli-patches"), { recursive: true });
      await mkdir(path.join(tmpDir, "repos", "cli-repo"), { recursive: true });
      const { writeFileIn } = await import("~/testing/fs-test-utils");
      await writeFileIn(
        path.join(tmpDir, "cli-patches"),
        "001-my-set/file.ts",
        "content",
      );

      const { result } = await runCli(
        `patchy apply --target-repo cli-repo --patches-dir cli-patches --config patchy.json --dry-run --verbose`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput(
        "[DRY RUN] Would apply patches from ./cli-patches to ./cli-repo",
      );
    });
  });

  describe("commit behavior", () => {
    it("should fail when working tree is dirty", async () => {
      const { runCli, tmpDir } = await scenario({
        git: true,
        patches: {
          "001-first": { "new.ts": "content" },
        },
      });

      const { writeFileIn } = await import("~/testing/fs-test-utils");
      await writeFileIn(
        path.join(tmpDir, "repos", "main"),
        "dirty.txt",
        "uncommitted changes",
      );

      const { result } = await runCli(`patchy apply`);

      expect(result).toFail();
      expect(result.stderr).toContain("Working tree is dirty");
    });

    it("should fail when git status check fails", async () => {
      const { runCli, tmpDir } = await scenario({
        patches: {
          "001-first": { "new.ts": "content" },
        },
      });

      const { writeFileIn } = await import("~/testing/fs-test-utils");
      await writeFileIn(
        path.join(tmpDir, "repos", "main"),
        ".git",
        "not a valid git directory",
      );

      const { result } = await runCli(`patchy apply`);

      expect(result).toFail();
      expect(result.stderr).toContain("Failed to check working tree status");
    });

    it("should fail when commit fails", async () => {
      const { runCli, tmpDir } = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { writeFileIn } = await import("~/testing/fs-test-utils");
      await writeFileIn(
        path.join(tmpDir, "repos", "main"),
        ".git/index.lock",
        "locked",
      );

      const { result } = await runCli(`patchy apply --all`);

      expect(result).toFail();
      expect(result.stderr).toContain("Could not commit patch set");
    });

    it("should auto-commit all except last patch set by default in TTY", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
          "003-third": { "file3.ts": "content3" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set "003-third"/,
        respond: true,
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");
      expect(result.stdout).toContain("Committed patch set: 002-second");
      expect(result.stdout).toContain("Committed patch set: 003-third");

      const commitMessages = await commits();
      expect(commitMessages.length).toBeGreaterThan(1);
      expect(commitMessages[0]).toBe("Apply patch set: 003-third");
      expect(commitMessages[1]).toBe("Apply patch set: 002-second");
      expect(commitMessages[2]).toBe("Apply patch set: 001-first");
    });

    it("should prompt for last patch set and handle rejection", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { runCli, commits, gitStatus } = ctx.withPrompts({
        confirm: /Commit changes from patch set "002-second"/,
        respond: false,
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");
      expect(result.stdout).toContain("Left patch set uncommitted: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");

      const status = await gitStatus();
      expect(status.some((f) => f === "file2.ts")).toBe(true);
    });

    it("should commit all patch sets with --all flag", async () => {
      const { runCli, commits } = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { result } = await runCli(`patchy apply --all --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");
      expect(result.stdout).toContain("Committed patch set: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 002-second");
      expect(commitMessages[1]).toBe("Apply patch set: 001-first");
    });

    it("should leave last patch set uncommitted with --edit flag", async () => {
      const { runCli, commits, gitStatus } = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { result } = await runCli(`patchy apply --edit --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");
      expect(result.stdout).toContain("Left patch set uncommitted: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");

      const status = await gitStatus();
      expect(status.some((f) => f === "file2.ts")).toBe(true);
    });

    it("should fail when both --all and --edit are provided", async () => {
      const { runCli } = await scenario();

      const { result } = await runCli(`patchy apply --all --edit`);

      expect(result).toFail();
      expect(result.stderr).toContain(
        "Cannot use both --all and --edit flags together",
      );
    });

    it("should work with --only flag treating it as the last patch set", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set "001-first"/,
        respond: true,
      });

      const { result } = await runCli(
        `patchy apply --only 001-first --verbose`,
      );

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");
    });

    it("should work with --until flag treating last one as the last patch set", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
          "003-third": { "file3.ts": "content3" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set "002-second"/,
        respond: false,
      });

      const { result } = await runCli(
        `patchy apply --until 002-second --verbose`,
      );

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-first");
      expect(result.stdout).toContain("Left patch set uncommitted: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");
    });

    it("should not commit anything in dry-run mode", async () => {
      const { runCli, commits } = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
        },
      });

      const { result } = await runCli(`patchy apply --dry-run --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("[DRY RUN]");
      expect(result.stdout).not.toContain("Committed");

      const commitMessages = await commits();
      expect(commitMessages.length).toBe(1);
    });

    it("should commit single patch set with prompt in TTY", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-only": { "file1.ts": "content1" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set "001-only"/,
        respond: true,
      });

      const { result } = await runCli(`patchy apply --verbose`);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Committed patch set: 001-only");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-only");
    });
  });
});
