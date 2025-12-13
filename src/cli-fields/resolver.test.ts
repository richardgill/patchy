import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  generateTmpDir,
  getStabilizedJson,
  setupTestWithConfig,
  stabilizeTempDir,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/test-utils";
import { createEnrichedMergedConfig } from "./resolver";
import type { EnrichedMergedConfig, JsonConfigKey, SharedFlags } from "./types";

const expectSuccessfulMerge: (
  result: ReturnType<typeof createEnrichedMergedConfig>,
) => asserts result is { success: true; mergedConfig: EnrichedMergedConfig } = (
  result,
) => {
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.mergedConfig).toBeDefined();
  }
};

const expectFailedMerge: (
  result: ReturnType<typeof createEnrichedMergedConfig>,
) => asserts result is { success: false; error: string } = (result) => {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
  }
};

describe("createEnrichedMergedConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  it("should merge JSON config with CLI flags successfully", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "clonesDir1",
        repoDir: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        clones_dir: "clonesDir1",
        repo_dir: "repoDir1",
        ref: "main",
        verbose: true,
      },
    });

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "dry-run": true,
    };

    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/flag-repo.git",
        "repo_dir": "repoDir1",
        "clones_dir": "clonesDir1",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/clonesDir1",
        "absoluteRepoDir": "<TEST_DIR>/clonesDir1/repoDir1",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
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

    const flags: SharedFlags = {
      "dry-run": true,
    };

    const requiredFields: JsonConfigKey[] = ["repo_url", "repo_dir"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository URL: set repo_url in ./patchy.json, PATCHY_REPO_URL env var, or --repo-url flag
        Missing Repository directory: set repo_dir in ./patchy.json, PATCHY_REPO_DIR env var, or --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init

      "
    `);
  });

  it("should use default values when not specified", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "clonesDir1",
        repoDir: "repoDir1",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "clonesDir1",
        repo_dir: "repoDir1",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "repoDir1",
        "clones_dir": "clonesDir1",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/clonesDir1",
        "absoluteRepoDir": "<TEST_DIR>/clonesDir1/repoDir1",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should throw error when config file doesn't exist with explicit path", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const flags: SharedFlags = {
      config: "./non-existent-config.json",
    };
    const requiredFields: JsonConfigKey[] = ["repo_url"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-config.json"`,
    );
  });

  it("should throw error on invalid JSON", async () => {
    await writeTestFile(tmpDir, "invalid.json", "{ invalid json: content }");
    const invalidJsonPath = path.join(tmpDir, "invalid.json");

    const flags: SharedFlags = {
      config: invalidJsonPath,
    };
    const requiredFields: JsonConfigKey[] = ["repo_url"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(
      `
        "JSON parse error: InvalidSymbol

        >    1 | { invalid json: content }
                  ^"
      `,
    );
  });

  it("should fail validation when directories don't exist", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "non-existent-base",
        repo_dir: "non-existent-repo",
        patches_dir: "non-existent-patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      clones_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
      patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches

      "
    `);
  });

  it("should prioritize CLI flags over JSON values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "flag-base",
        repoDir: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        clones_dir: "json-base",
        repo_dir: "json-repo",
        patches_dir: "json-patches",
        ref: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "clones-dir": "flag-base",
      "repo-dir": "flag-repo",
      "patches-dir": "flag-patches",
      ref: "flag-ref",
      verbose: true,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/flag-repo.git",
        "repo_dir": "flag-repo",
        "clones_dir": "flag-base",
        "patches_dir": "flag-patches",
        "ref": "flag-ref",
        "verbose": true,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/flag-base",
        "absoluteRepoDir": "<TEST_DIR>/flag-base/flag-repo",
        "absolutePatchesDir": "<TEST_DIR>/flag-patches"
      }"
    `,
    );
  });

  it("should correctly resolve absolute paths", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "base",
        repo_dir: "repo",
        patches_dir: "patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "patches",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle empty JSON config file", async () => {
    await writeTestFile(tmpDir, "empty.json", "{}");
    const emptyJsonPath = path.join(tmpDir, "empty.json");

    const flags: SharedFlags = {
      config: emptyJsonPath,
      "repo-url": "https://github.com/example/repo.git",
    };
    const requiredFields: JsonConfigKey[] = ["repo_url"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "clones_dir": "./clones/",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/empty.json",
        "absoluteClonesDir": "<TEST_DIR>/clones",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle truly empty config file (no content)", async () => {
    await writeTestFile(tmpDir, "truly-empty.json", "");
    const emptyJsonPath = path.join(tmpDir, "truly-empty.json");

    const flags: SharedFlags = {
      config: emptyJsonPath,
      "repo-url": "https://github.com/example/repo.git",
    };
    const requiredFields: JsonConfigKey[] = ["repo_url"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(
      `
        "JSON parse error: ValueExpected

        >    1 | 
                ^"
      `,
    );
  });

  it("should handle different combinations of missing required fields", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = ["clones_dir", "patches_dir"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    // Now clones_dir and patches_dir have defaults, so validation fails on missing directories
    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      Clones directory does not exist: <TEST_DIR>/clones
      Patches directory does not exist: <TEST_DIR>/patches

      "
    `);
  });

  it("should handle boolean flags correctly", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "base",
        repo_dir: "repo",
        verbose: false,
      },
    });

    const flags: SharedFlags = {
      verbose: true,
      "dry-run": true,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should correctly join clones_dir and repo_dir paths", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "my-base/nested",
        repoDir: "my-repo/nested-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "my-base/nested",
        repo_dir: "my-repo/nested-repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "my-repo/nested-repo",
        "clones_dir": "my-base/nested",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/my-base/nested",
        "absoluteRepoDir": "<TEST_DIR>/my-base/nested/my-repo/nested-repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should use custom config path", async () => {
    const customConfigPath = path.join(tmpDir, "custom", "config.json");

    await setupTestWithConfig({
      tmpDir,
      configPath: customConfigPath,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/custom.git",
        clones_dir: "base",
        repo_dir: "repo",
        ref: "custom-branch",
      },
    });

    const flags: SharedFlags = {
      config: customConfigPath,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/custom.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "./patches/",
        "ref": "custom-branch",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/custom/config.json",
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle working directory changes with cwd parameter", async () => {
    const subDir = path.join(tmpDir, "subdir");
    await setupTestWithConfig({
      tmpDir: subDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const originalCwd = process.cwd();
    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: subDir,
    });

    expectSuccessfulMerge(result);
    expect(process.cwd()).toBe(originalCwd);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/subdir/base",
        "absoluteRepoDir": "<TEST_DIR>/subdir/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/subdir/patches"
      }"
    `,
    );
  });

  it("should restore process working directory after execution", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];
    const originalCwd = process.cwd();

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(process.cwd()).toBe(originalCwd);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle Zod validation errors for invalid JSON structure", async () => {
    await writeJsonConfig(tmpDir, "invalid-structure.json", {
      repo_url: 123,
      verbose: "not-a-boolean",
      ref: ["array", "not", "string"],
    });
    const invalidJsonPath = path.join(tmpDir, "invalid-structure.json");

    const flags: SharedFlags = {
      config: invalidJsonPath,
    };
    const requiredFields: JsonConfigKey[] = ["repo_url"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toContain("Invalid input");
  });

  it("should fail validation when repo URL is invalid", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "invalid-url-format",
        clones_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      repo_url: invalid-url-format in ./patchy.json is invalid. Example repo: https://github.com/user/repo.git

      "
    `);
  });

  it("should handle empty string fields (now accepted by schema)", async () => {
    await writeJsonConfig(tmpDir, "empty-strings.json", {
      repo_url: "",
      ref: "",
      clones_dir: "",
    });
    const jsonPath = path.join(tmpDir, "empty-strings.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    // Empty strings are now accepted by schema (since requiredInConfig: false)
    // Config values override defaults, so empty strings take precedence
    expectSuccessfulMerge(result);
    expect(result.mergedConfig.repo_url).toBe("");
    expect(result.mergedConfig.ref).toBe("");
    expect(result.mergedConfig.clones_dir).toBe("");
  });

  it("should handle Zod validation error for null values", async () => {
    await writeJsonConfig(tmpDir, "null-values.json", {
      repo_url: null,
      verbose: null,
      patches_dir: null,
    });
    const jsonPath = path.join(tmpDir, "null-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received null
      patches_dir: Invalid input: expected string, received null
      verbose: Invalid input: expected boolean, received null"
    `);
  });

  it("should handle Zod strict mode error for unknown fields", async () => {
    await writeJsonConfig(tmpDir, "unknown-fields.json", {
      repo_url: "https://github.com/user/repo.git",
      unknown_field: "value",
      another_unknown: 123,
    });
    const jsonPath = path.join(tmpDir, "unknown-fields.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(
      `"Unrecognized keys: "unknown_field", "another_unknown""`,
    );
  });

  it("should handle boolean field with string value", async () => {
    await writeJsonConfig(tmpDir, "boolean-string.json", {
      verbose: "yes",
      dry_run: "true",
    });
    const jsonPath = path.join(tmpDir, "boolean-string.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should handle array values where strings are expected", async () => {
    await writeJsonConfig(tmpDir, "array-values.json", {
      repo_url: ["https://github.com/user/repo.git"],
      ref: ["main", "develop"],
      patches_dir: ["./patches"],
    });
    const jsonPath = path.join(tmpDir, "array-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received array
      ref: Invalid input: expected string, received array"
    `);
  });

  it("should handle object values where primitives are expected", async () => {
    await writeJsonConfig(tmpDir, "object-values.json", {
      repo_url: { url: "https://github.com/user/repo.git" },
      verbose: { enabled: true },
    });
    const jsonPath = path.join(tmpDir, "object-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received object
      verbose: Invalid input: expected boolean, received object"
    `);
  });

  it("should handle multiple Zod errors with mixed types", async () => {
    await writeJsonConfig(tmpDir, "mixed-errors.json", {
      repo_url: 123,
      ref: true,
      clones_dir: ["base"],
      repo_dir: null,
      patches_dir: {},
      verbose: "false",
      dry_run: 1,
    });
    const jsonPath = path.join(tmpDir, "mixed-errors.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };
    const requiredFields: JsonConfigKey[] = [];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "repo_url: Invalid input: expected string, received number
      repo_dir: Invalid input: expected string, received null
      clones_dir: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received object
      ref: Invalid input: expected string, received boolean
      verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should use environment variables when flags and JSON are not set", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "env-base",
        repoDir: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_REPO_DIR: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_REF: "env-branch",
      PATCHY_VERBOSE: "true",
      PATCHY_DRY_RUN: "1",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/env-repo.git",
        "repo_dir": "env-repo",
        "clones_dir": "env-base",
        "patches_dir": "env-patches",
        "ref": "env-branch",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/env-base",
        "absoluteRepoDir": "<TEST_DIR>/env-base/env-repo",
        "absolutePatchesDir": "<TEST_DIR>/env-patches"
      }"
    `,
    );
  });

  it("should prioritize CLI flags over environment variables", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "flag-base",
        repoDir: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "clones-dir": "flag-base",
      "repo-dir": "flag-repo",
      "patches-dir": "flag-patches",
      ref: "flag-ref",
      verbose: true,
      "dry-run": true,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_REPO_DIR: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_REF: "env-branch",
      PATCHY_VERBOSE: "false",
      PATCHY_DRY_RUN: "false",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/flag-repo.git",
        "repo_dir": "flag-repo",
        "clones_dir": "flag-base",
        "patches_dir": "flag-patches",
        "ref": "flag-ref",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/flag-base",
        "absoluteRepoDir": "<TEST_DIR>/flag-base/flag-repo",
        "absolutePatchesDir": "<TEST_DIR>/flag-patches"
      }"
    `,
    );
  });

  it("should prioritize environment variables over JSON config", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "env-base",
        repoDir: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/json-repo.git",
        clones_dir: "json-base",
        repo_dir: "json-repo",
        patches_dir: "json-patches",
        ref: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_REPO_DIR: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_REF: "env-branch",
      PATCHY_VERBOSE: "true",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/env-repo.git",
        "repo_dir": "env-repo",
        "clones_dir": "env-base",
        "patches_dir": "env-patches",
        "ref": "env-branch",
        "verbose": true,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteClonesDir": "<TEST_DIR>/env-base",
        "absoluteRepoDir": "<TEST_DIR>/env-base/env-repo",
        "absolutePatchesDir": "<TEST_DIR>/env-patches"
      }"
    `,
    );
  });

  it("should use PATCHY_CONFIG env var for config path", async () => {
    const customConfigPath = path.join(tmpDir, "custom-env", "env-config.json");

    await setupTestWithConfig({
      tmpDir,
      configPath: customConfigPath,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/env-config.git",
        clones_dir: "base",
        repo_dir: "repo",
        ref: "env-config-branch",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];
    const env = {
      PATCHY_CONFIG: customConfigPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/env-config.git",
        "repo_dir": "repo",
        "clones_dir": "base",
        "patches_dir": "./patches/",
        "ref": "env-config-branch",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/custom-env/env-config.json",
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should fail when PATCHY_CONFIG env var points to non-existent file", async () => {
    mkdirSync(tmpDir, { recursive: true });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = ["repo_url"];
    const env = {
      PATCHY_CONFIG: "./non-existent-env-config.json",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-env-config.json"`,
    );
  });

  it("should handle boolean env vars with different truthy values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        clones_dir: "base",
        repo_dir: "repo",
      },
    });

    const testCases = [
      {
        PATCHY_VERBOSE: "true",
        PATCHY_DRY_RUN: "1",
        expectedVerbose: true,
        expectedDryRun: true,
      },
      {
        PATCHY_VERBOSE: "TRUE",
        PATCHY_DRY_RUN: "True",
        expectedVerbose: true,
        expectedDryRun: true,
      },
      {
        PATCHY_VERBOSE: "false",
        PATCHY_DRY_RUN: "0",
        expectedVerbose: false,
        expectedDryRun: false,
      },
      {
        PATCHY_VERBOSE: "yes",
        PATCHY_DRY_RUN: "no",
        expectedVerbose: false,
        expectedDryRun: false,
      },
    ];

    for (const {
      PATCHY_VERBOSE,
      PATCHY_DRY_RUN,
      expectedVerbose,
      expectedDryRun,
    } of testCases) {
      const result = createEnrichedMergedConfig({
        flags: {},
        requiredFields: ["repo_url", "clones_dir", "repo_dir"],
        cwd: tmpDir,
        env: { PATCHY_VERBOSE, PATCHY_DRY_RUN },
      });

      expectSuccessfulMerge(result);
      expect(result.mergedConfig.verbose).toBe(expectedVerbose);
      expect(result.mergedConfig.dry_run).toBe(expectedDryRun);
    }
  });

  it("should ignore empty string env vars", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "json-base",
        repoDir: "json-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/json-repo.git",
        clones_dir: "json-base",
        repo_dir: "json-repo",
        ref: "json-ref",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "clones_dir",
      "repo_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "",
      PATCHY_REF: "",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(result.mergedConfig.repo_url).toBe(
      "https://github.com/example/json-repo.git",
    );
    expect(result.mergedConfig.ref).toBe("json-ref");
  });
});
