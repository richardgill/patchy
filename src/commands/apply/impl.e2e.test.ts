import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  writeFileIn,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/test-utils";

describe("patchy apply", () => {
  it("should apply patches with all flags specified", async () => {
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
        target_repo: "config-repo",
      },
    });

    const result = await runCli(
      `patchy apply --target-repo main --clones-dir repos --patches-dir patches --config patchy.json --verbose --dry-run`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches to ./main
      No patch files found."
    `);
  });

  it("should apply patches using config file values", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "my-patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/test-repo.git",
        target_repo: "upstream",
        clones_dir: `${tmpDir}/repos`,
        patches_dir: "my-patches",
        ref: "main",
      },
    });

    const result = await runCli(
      `patchy apply --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./my-patches to ./upstream
      No patch files found."
    `);
  });

  it("should override config file values with CLI flags", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
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

    const result = await runCli(
      `patchy apply --target-repo cli-repo --patches-dir cli-patches --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./cli-patches to ./cli-repo
      No patch files found."
    `);
  });

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

  it("should succeed even with invalid repo URL since it's not required for apply", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "invalid-url-format",
        clones_dir: "base",
        target_repo: "repo",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repo
      No patch files found."
    `);
  });

  it("should handle empty JSON config file with CLI flags", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "empty.json", "{}");

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {},
    });

    const result = await runCli(
      `patchy apply --config empty.json --source-repo https://github.com/example/repo.git --clones-dir base --target-repo repo --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repo
      No patch files found."
    `);
  });

  it("should handle boolean flags correctly", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
        verbose: false,
      },
    });

    const result = await runCli(`patchy apply --verbose --dry-run`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repo
      No patch files found."
    `);
  });

  it("should use custom config path", async () => {
    const tmpDir = generateTmpDir();
    const customConfigPath = path.join(tmpDir, "custom", "config.json");

    await setupTestWithConfig({
      tmpDir,
      configPath: customConfigPath,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/custom.git",
        clones_dir: "base",
        target_repo: "repo",
        ref: "custom-branch",
      },
    });

    const result = await runCli(
      `patchy apply --config ${customConfigPath} --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repo
      No patch files found."
    `);
  });

  it("should correctly join clones_dir and target_repo paths", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "my-base/nested",
        targetRepo: "my-repo/nested-repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "my-base/nested",
        target_repo: "my-repo/nested-repo",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./my-repo/nested-repo
      No patch files found."
    `);
  });

  it("should use default values when not specified", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "clonesDir1",
        targetRepo: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "clonesDir1",
        target_repo: "repoDir1",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repoDir1
      No patch files found."
    `);
  });

  it("should handle different combinations of missing required fields", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
      },
    });

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should handle ref override from CLI", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
        ref: "json-ref",
      },
    });

    const result = await runCli(
      `patchy apply --ref cli-ref --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to ./repo
      No patch files found."
    `);
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

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from <TEST_DIR>/absolute-patches to ./repo
      No patch files found."
    `);
  });

  it("should handle truly empty JSON file", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "truly-empty.json", "");

    const result = await runCli(
      `patchy apply --config truly-empty.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "JSON parse error: ValueExpected

      >    1 | 
              ^"
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

  it("should handle Zod validation error for empty string fields", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "empty-strings.json", {
      source_repo: "",
      ref: "",
      clones_dir: "",
    });

    const result = await runCli(
      `patchy apply --config empty-strings.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Target repository: set target_repo in ./empty-strings.json, PATCHY_TARGET_REPO env var, or --target-repo flag

      You can set up empty-strings.json by running:
        patchy init --config empty-strings.json"
    `);
  });

  it("should handle Zod validation error for null values", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "null-values.json", {
      source_repo: null,
      verbose: null,
      patches_dir: null,
    });

    const result = await runCli(
      `patchy apply --config null-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received null
      patches_dir: Invalid input: expected string, received null
      verbose: Invalid input: expected boolean, received null"
    `);
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

  it("should handle boolean field with string value", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "boolean-string.json", {
      verbose: "yes",
      dry_run: "true",
    });

    const result = await runCli(
      `patchy apply --config boolean-string.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should handle array values where strings are expected", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "array-values.json", {
      source_repo: ["https://github.com/user/repo.git"],
      ref: ["main", "develop"],
      patches_dir: ["./patches"],
    });

    const result = await runCli(
      `patchy apply --config array-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received array
      ref: Invalid input: expected string, received array"
    `);
  });

  it("should handle object values where primitives are expected", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "object-values.json", {
      source_repo: { url: "https://github.com/user/repo.git" },
      verbose: { enabled: true },
    });

    const result = await runCli(
      `patchy apply --config object-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received object
      verbose: Invalid input: expected boolean, received object"
    `);
  });

  it("should handle multiple Zod errors with mixed types", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "mixed-errors.json", {
      source_repo: 123,
      ref: true,
      clones_dir: ["base"],
      target_repo: null,
      patches_dir: {},
      verbose: "false",
      dry_run: 1,
    });

    const result = await runCli(
      `patchy apply --config mixed-errors.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received number
      target_repo: Invalid input: expected string, received null
      clones_dir: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received object
      ref: Invalid input: expected string, received boolean
      verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should copy new files from patches to repo", async () => {
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
      "newFile.ts",
      'export const hello = "world";',
    );

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Applying 1 patch file(s)...");
    expect(result).toHaveOutput("Copied: newFile.ts");
    expect(result).toHaveOutput("Successfully applied 1 patch file(s).");

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
      "src/utils/helper.ts",
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
      "existing.ts.diff",
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

  it("should handle mixed files (copies and diffs)", async () => {
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
    await writeFileIn(patchesDir, "new.ts", "export const y = 2;");
    await writeFileIn(
      patchesDir,
      "existing.ts.diff",
      `--- a/existing.ts
+++ b/existing.ts
@@ -1 +1 @@
-const x = 1;
+const x = 100;
`,
    );

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Applying 2 patch file(s)...");
    expect(result).toHaveOutput("Successfully applied 2 patch file(s).");

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
      "missing.ts.diff",
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

    await writeFileIn(patchesDir, "newFile.ts", "content");
    await writeFileIn(patchesDir, "existing.ts.diff", "diff content");

    const result = await runCli(`patchy apply --dry-run`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("[DRY RUN]");
    expect(result).toHaveOutput("Would apply 2 file(s):");
    expect(result).toHaveOutput("Apply diff: existing.ts.diff");
    expect(result).toHaveOutput("Copy: newFile.ts");

    expect(path.join(repoDir, "newFile.ts")).not.toExist();
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

    await writeFileIn(patchesDir, "complex.tsx", complexContent);

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toSucceed();
    expect(path.join(repoDir, "complex.tsx")).toHaveFileContent(complexContent);
  });

  it("should apply diff with fuzzy matching when context lines are missing from target", async () => {
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

    // The target file has fewer lines than the diff's context expects
    await writeFileIn(
      repoDir,
      "fuzzy.ts",
      `const value = 1;
const other = 2;
`,
    );

    // The diff has an extra context line that doesn't exist in the target
    await writeFileIn(
      patchesDir,
      "fuzzy.ts.diff",
      `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
    );

    // With default fuzz factor (2), this should still apply despite missing context
    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Applied diff: fuzzy.ts.diff");

    expect(path.join(repoDir, "fuzzy.ts")).toHaveFileContent(
      `const value = 42;
const other = 2;
`,
    );
  });

  it("should fail to apply diff when fuzz-factor is 0 and context lines are missing", async () => {
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

    // The target file has fewer lines than the diff's context expects
    await writeFileIn(
      repoDir,
      "fuzzy.ts",
      `const value = 1;
const other = 2;
`,
    );

    // The diff has an extra context line that doesn't exist in the target
    await writeFileIn(
      patchesDir,
      "fuzzy.ts.diff",
      `--- a/fuzzy.ts
+++ b/fuzzy.ts
@@ -1,3 +1,3 @@
-const value = 1;
+const value = 42;
 const other = 2;
 EXTRA CONTEXT LINE
`,
    );

    // With fuzz-factor 0, this should fail because the context line doesn't match
    const result = await runCli(`patchy apply --fuzz-factor 0`, tmpDir);

    expect(result).toFailWith("Errors occurred while applying patches:");
    expect(result.stderr).toContain("Patch failed to apply");
  });
});
