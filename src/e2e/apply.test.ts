import { beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

describe("patchy apply", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = generateTmpDir();
  });

  it("should apply patches with all flags specified", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "config-repo",
      },
    });

    const result = await runCli(
      `patchy apply --repo-dir main --repo-base-dir repos --patches-dir patches --config patchy.json --verbose --dry-run`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from patches to main
      No patch files found."
    `);
  });

  it("should apply patches using config file values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "my-patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "upstream",
        repo_base_dir: `${tmpDir}/repos`,
        patches_dir: "my-patches",
        ref: "main",
      },
    });

    const result = await runCli(
      `patchy apply --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from my-patches to upstream
      No patch files found."
    `);
  });

  it("should override config file values with CLI flags", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "cli-patches",
        repoBaseDir: "repos",
        repoDir: "cli-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "config-repo",
        repo_base_dir: `${tmpDir}/repos`,
        patches_dir: "config-patches",
        ref: "main",
      },
    });

    const result = await runCli(
      `patchy apply --repo-dir cli-repo --patches-dir cli-patches --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from cli-patches to cli-repo
      No patch files found."
    `);
  });

  it("should fail when required fields are missing", async () => {
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
    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json, PATCHY_REPO_BASE_DIR env var, or --repo-base-dir flag
        Missing Repository directory: set repo_dir in ./patchy.json, PATCHY_REPO_DIR env var, or --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should fail when config file doesn't exist with explicit path", async () => {
    mkdirSync(tmpDir, { recursive: true });

    const result = await runCli(
      `patchy apply --config ./non-existent-config.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-config.json"`,
    );
  });

  it("should fail on invalid JSON syntax", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const invalidJsonPath = path.join(tmpDir, "invalid.json");
    writeFileSync(invalidJsonPath, "{ invalid json: content }");

    const result = await runCli(`patchy apply --config invalid.json`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "JSON parse error: InvalidSymbol

      >    1 | { invalid json: content }
                ^"
    `);
  });

  it("should fail validation when directories don't exist", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "non-existent-base",
        repo_dir: "non-existent-repo",
        patches_dir: "non-existent-patches",
      },
    });

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toFail();
    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Validation errors:

      repo_base_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
      patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches"
    `);
  });

  it("should succeed even with invalid repo URL since it's not required for apply", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "invalid-url-format",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repo
      No patch files found."
    `);
  });

  it("should handle empty JSON config file with CLI flags", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "empty.json");
    writeFileSync(emptyJsonPath, "{}");

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {},
    });

    const result = await runCli(
      `patchy apply --config empty.json --repo-url https://github.com/example/repo.git --repo-base-dir base --repo-dir repo --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repo
      No patch files found."
    `);
  });

  it("should handle boolean flags correctly", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        verbose: false,
        dry_run: false,
      },
    });

    const result = await runCli(`patchy apply --verbose --dry-run`, tmpDir);

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repo
      No patch files found."
    `);
  });

  it("should use custom config path", async () => {
    const customConfigDir = path.join(tmpDir, "custom");
    const customConfigPath = path.join(customConfigDir, "config.json");
    mkdirSync(customConfigDir, { recursive: true });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/custom.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        ref: "custom-branch",
      },
    });

    writeFileSync(
      customConfigPath,
      JSON.stringify(
        {
          repo_url: "https://github.com/example/custom.git",
          repo_base_dir: "base",
          repo_dir: "repo",
          ref: "custom-branch",
        },
        null,
        2,
      ),
    );

    const result = await runCli(
      `patchy apply --config ${customConfigPath} --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repo
      No patch files found."
    `);
  });

  it("should correctly join repo_base_dir and repo_dir paths", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "my-base/nested",
        repoDir: "my-repo/nested-repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "my-base/nested",
        repo_dir: "my-repo/nested-repo",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to my-repo/nested-repo
      No patch files found."
    `);
  });

  it("should use default values when not specified", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repoBaseDir1",
        repoDir: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "repoBaseDir1",
        repo_dir: "repoDir1",
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repoDir1
      No patch files found."
    `);
  });

  it("should handle different combinations of missing required fields", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
      },
    });

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toFail();
    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json, PATCHY_REPO_BASE_DIR env var, or --repo-base-dir flag
        Missing Repository directory: set repo_dir in ./patchy.json, PATCHY_REPO_DIR env var, or --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should handle ref override from CLI", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        ref: "json-ref",
      },
    });

    const result = await runCli(
      `patchy apply --ref cli-ref --dry-run --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from ./patches/ to repo
      No patch files found."
    `);
  });

  it("should handle absolute paths in config", async () => {
    const absoluteBase = path.join(tmpDir, "absolute-base");
    const absolutePatches = path.join(tmpDir, "absolute-patches");

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "absolute-base",
        repoDir: "repo",
        patchesDir: "absolute-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: absoluteBase,
        repo_dir: "repo",
        patches_dir: absolutePatches,
      },
    });

    const result = await runCli(`patchy apply --dry-run --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "[DRY RUN] Would apply patches from <TEST_DIR>/absolute-patches to repo
      No patch files found."
    `);
  });

  it("should handle truly empty JSON file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "truly-empty.json");
    writeFileSync(emptyJsonPath, "");

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
    mkdirSync(tmpDir, { recursive: true });
    const invalidJsonPath = path.join(tmpDir, "invalid-structure.json");
    writeFileSync(
      invalidJsonPath,
      JSON.stringify({
        repo_url: 123,
        verbose: "not-a-boolean",
        ref: ["array", "not", "string"],
      }),
    );

    const result = await runCli(
      `patchy apply --config invalid-structure.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toContain("Invalid input");
  });

  it("should handle Zod validation error for empty string fields", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "empty-strings.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: "",
        ref: "",
        repo_base_dir: "",
      }),
    );

    const result = await runCli(
      `patchy apply --config empty-strings.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "repo_url: Repository URL is required
      repo_base_dir: Repository base directory is required
      ref: Git reference is required"
    `);
  });

  it("should handle Zod validation error for null values", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "null-values.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: null,
        verbose: null,
        patches_dir: null,
      }),
    );

    const result = await runCli(
      `patchy apply --config null-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received null
      patches_dir: Invalid input: expected string, received null
      verbose: Invalid input: expected boolean, received null"
    `);
  });

  it("should handle Zod strict mode error for unknown fields", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "unknown-fields.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        unknown_field: "value",
        another_unknown: 123,
      }),
    );

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
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "boolean-string.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        verbose: "yes",
        dry_run: "true",
      }),
    );

    const result = await runCli(
      `patchy apply --config boolean-string.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "verbose: Invalid input: expected boolean, received string
      dry_run: Invalid input: expected boolean, received string"
    `);
  });

  it("should handle array values where strings are expected", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "array-values.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: ["https://github.com/user/repo.git"],
        ref: ["main", "develop"],
        patches_dir: ["./patches"],
      }),
    );

    const result = await runCli(
      `patchy apply --config array-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received array
      ref: Invalid input: expected string, received array"
    `);
  });

  it("should handle object values where primitives are expected", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "object-values.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: { url: "https://github.com/user/repo.git" },
        verbose: { enabled: true },
      }),
    );

    const result = await runCli(
      `patchy apply --config object-values.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received object
      verbose: Invalid input: expected boolean, received object"
    `);
  });

  it("should handle multiple Zod errors with mixed types", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "mixed-errors.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: 123,
        ref: true,
        repo_base_dir: ["base"],
        repo_dir: null,
        patches_dir: {},
        verbose: "false",
        dry_run: 1,
      }),
    );

    const result = await runCli(
      `patchy apply --config mixed-errors.json`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received number
      repo_dir: Invalid input: expected string, received null
      repo_base_dir: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received object
      ref: Invalid input: expected string, received boolean
      verbose: Invalid input: expected boolean, received string
      dry_run: Invalid input: expected boolean, received number"
    `);
  });

  it("should copy new files from patches to repo", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    const patchFile = path.join(patchesDir, "newFile.ts");
    writeFileSync(patchFile, 'export const hello = "world";');

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain("Applying 1 patch file(s)...");
    expect(result.stdout).toContain("Copied: newFile.ts");
    expect(result.stdout).toContain("Successfully applied 1 patch file(s).");

    const targetFile = path.join(repoDir, "newFile.ts");
    expect(existsSync(targetFile)).toBe(true);
    expect(readFileSync(targetFile, "utf-8")).toBe(
      'export const hello = "world";',
    );
  });

  it("should copy new files in nested directories", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    const nestedPatchDir = path.join(patchesDir, "src", "utils");
    mkdirSync(nestedPatchDir, { recursive: true });
    const patchFile = path.join(nestedPatchDir, "helper.ts");
    writeFileSync(
      patchFile,
      "export const add = (a: number, b: number) => a + b;",
    );

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain("Copied: src/utils/helper.ts");

    const targetFile = path.join(repoDir, "src", "utils", "helper.ts");
    expect(existsSync(targetFile)).toBe(true);
    expect(readFileSync(targetFile, "utf-8")).toBe(
      "export const add = (a: number, b: number) => a + b;",
    );
  });

  it("should apply diff files to existing files", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    const targetFile = path.join(repoDir, "existing.ts");
    writeFileSync(targetFile, "const value = 1;\nconst other = 2;\n");

    const diffFile = path.join(patchesDir, "existing.ts.diff");
    writeFileSync(
      diffFile,
      `--- a/existing.ts
+++ b/existing.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`,
    );

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain("Applied diff: existing.ts.diff");

    expect(readFileSync(targetFile, "utf-8")).toBe(
      "const value = 42;\nconst other = 2;\n",
    );
  });

  it("should handle mixed files (copies and diffs)", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    const existingFile = path.join(repoDir, "existing.ts");
    writeFileSync(existingFile, "const x = 1;\n");

    const newPatchFile = path.join(patchesDir, "new.ts");
    writeFileSync(newPatchFile, "export const y = 2;");

    const diffFile = path.join(patchesDir, "existing.ts.diff");
    writeFileSync(
      diffFile,
      `--- a/existing.ts
+++ b/existing.ts
@@ -1 +1 @@
-const x = 1;
+const x = 100;
`,
    );

    const result = await runCli(`patchy apply --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain("Applying 2 patch file(s)...");
    expect(result.stdout).toContain("Successfully applied 2 patch file(s).");

    expect(readFileSync(existingFile, "utf-8")).toBe("const x = 100;\n");
    const newTargetFile = path.join(repoDir, "new.ts");
    expect(readFileSync(newTargetFile, "utf-8")).toBe("export const y = 2;");
  });

  it("should report error when diff target file does not exist", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;

    const diffFile = path.join(patchesDir, "missing.ts.diff");
    writeFileSync(
      diffFile,
      `--- a/missing.ts
+++ b/missing.ts
@@ -1 +1 @@
-old
+new
`,
    );

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toContain("Errors occurred while applying patches:");
    expect(result.stderr).toContain(
      "missing.ts.diff: Target file does not exist",
    );
  });

  it("should list what would be done in dry-run mode", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    const newFile = path.join(patchesDir, "newFile.ts");
    writeFileSync(newFile, "content");

    const diffFile = path.join(patchesDir, "existing.ts.diff");
    writeFileSync(diffFile, "diff content");

    const result = await runCli(`patchy apply --dry-run`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain("[DRY RUN]");
    expect(result.stdout).toContain("Would apply 2 file(s):");
    expect(result.stdout).toContain("Apply diff: existing.ts.diff");
    expect(result.stdout).toContain("Copy: newFile.ts");

    expect(existsSync(path.join(repoDir, "newFile.ts"))).toBe(false);
  });

  it("should preserve file content when copying", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
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
    const repoDir = ctx.absoluteRepoDir as string;

    const patchFile = path.join(patchesDir, "complex.tsx");
    writeFileSync(patchFile, complexContent);

    const result = await runCli(`patchy apply`, tmpDir);

    expect(result).toSucceed();
    const targetFile = path.join(repoDir, "complex.tsx");
    expect(readFileSync(targetFile, "utf-8")).toBe(complexContent);
  });

  it("should apply diff with fuzzy matching when context lines are missing from target", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    // The target file has fewer lines than the diff's context expects
    const targetFile = path.join(repoDir, "fuzzy.ts");
    writeFileSync(
      targetFile,
      `const value = 1;
const other = 2;
`,
    );

    // The diff has an extra context line that doesn't exist in the target
    const diffFile = path.join(patchesDir, "fuzzy.ts.diff");
    writeFileSync(
      diffFile,
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
    expect(result.stdout).toContain("Applied diff: fuzzy.ts.diff");

    expect(readFileSync(targetFile, "utf-8")).toBe(
      `const value = 42;
const other = 2;
`,
    );
  });

  it("should fail to apply diff when fuzz-factor is 0 and context lines are missing", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const patchesDir = ctx.absolutePatchesDir as string;
    const repoDir = ctx.absoluteRepoDir as string;

    // The target file has fewer lines than the diff's context expects
    const targetFile = path.join(repoDir, "fuzzy.ts");
    writeFileSync(
      targetFile,
      `const value = 1;
const other = 2;
`,
    );

    // The diff has an extra context line that doesn't exist in the target
    const diffFile = path.join(patchesDir, "fuzzy.ts.diff");
    writeFileSync(
      diffFile,
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

    expect(result).toFail();
    expect(result.stderr).toContain("Errors occurred while applying patches:");
    expect(result.stderr).toContain("Patch failed to apply");
  });
});
