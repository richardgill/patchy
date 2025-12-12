import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generateTmpDir,
  getStabilizedJson,
  setupTestWithConfig,
  stabilizeTempDir,
} from "~/testing/test-utils";
import {
  createEnrichedMergedConfig,
  parseOptionalJsonConfig,
} from "./resolver";
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
        repoBaseDir: "repoBaseDir1",
        repoDir: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "repoBaseDir1",
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
      "repo_base_dir",
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
        "repo_base_dir": "repoBaseDir1",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/repoBaseDir1",
        "absoluteRepoDir": "<TEST_DIR>/repoBaseDir1/repoDir1",
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

    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
    ];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository URL: set repo_url in ./patchy.json, PATCHY_REPO_URL env var, or --repo-url flag
        Missing Repository base directory: set repo_base_dir in ./patchy.json, PATCHY_REPO_BASE_DIR env var, or --repo-base-dir flag
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
        repoBaseDir: "repoBaseDir1",
        repoDir: "repoDir1",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "repoBaseDir1",
        repo_dir: "repoDir1",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "repoBaseDir1",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/repoBaseDir1",
        "absoluteRepoDir": "<TEST_DIR>/repoBaseDir1/repoDir1",
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
    mkdirSync(tmpDir, { recursive: true });
    const invalidJsonPath = path.join(tmpDir, "invalid.json");
    writeFileSync(invalidJsonPath, "{ invalid json: content }");

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
        repo_base_dir: "non-existent-base",
        repo_dir: "non-existent-repo",
        patches_dir: "non-existent-patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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

      repo_base_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
      patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches

      "
    `);
  });

  it("should prioritize CLI flags over JSON values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "flag-base",
        repoDir: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: "json-base",
        repo_dir: "json-repo",
        patches_dir: "json-patches",
        ref: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "repo-base-dir": "flag-base",
      "repo-dir": "flag-repo",
      "patches-dir": "flag-patches",
      ref: "flag-ref",
      verbose: true,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "flag-base",
        "patches_dir": "flag-patches",
        "ref": "flag-ref",
        "verbose": true,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/flag-base",
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
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        patches_dir: "patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "patches",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle empty JSON config file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "empty.json");
    writeFileSync(emptyJsonPath, "{}");

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
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/empty.json",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle empty JSON config file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "truly-empty.json");
    writeFileSync(emptyJsonPath, "");

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
    const requiredFields: JsonConfigKey[] = ["repo_base_dir", "patches_dir"];

    const result = createEnrichedMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json, PATCHY_REPO_BASE_DIR env var, or --repo-base-dir flag

      You can set up ./patchy.json by running:
        patchy init

      "
    `);
  });

  it("should handle boolean flags correctly", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
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
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should correctly join repo_base_dir and repo_dir paths", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "my-base/nested",
        repoDir: "my-repo/nested-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "my-base/nested",
        repo_dir: "my-repo/nested-repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "my-base/nested",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/my-base/nested",
        "absoluteRepoDir": "<TEST_DIR>/my-base/nested/my-repo/nested-repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
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

    const flags: SharedFlags = {
      config: customConfigPath,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "./patches/",
        "ref": "custom-branch",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/custom/config.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
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
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/subdir/base",
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
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "./patches/",
        "ref": "main",
        "verbose": false,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle Zod validation errors for invalid JSON structure", async () => {
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
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "invalid-url-format",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "boolean-string.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        verbose: "yes",
        dry_run: "true",
      }),
    );

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
    mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, "object-values.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        repo_url: { url: "https://github.com/user/repo.git" },
        verbose: { enabled: true },
      }),
    );

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
      repo_base_dir: Invalid input: expected string, received array
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
        repoBaseDir: "env-base",
        repoDir: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_REPO_BASE_DIR: "env-base",
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
        "repo_base_dir": "env-base",
        "patches_dir": "env-patches",
        "ref": "env-branch",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/env-base",
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
        repoBaseDir: "flag-base",
        repoDir: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "repo-base-dir": "flag-base",
      "repo-dir": "flag-repo",
      "patches-dir": "flag-patches",
      ref: "flag-ref",
      verbose: true,
      "dry-run": true,
    };
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_REPO_BASE_DIR: "env-base",
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
        "repo_base_dir": "flag-base",
        "patches_dir": "flag-patches",
        "ref": "flag-ref",
        "verbose": true,
        "dry_run": true,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/flag-base",
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
        repoBaseDir: "env-base",
        repoDir: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/json-repo.git",
        repo_base_dir: "json-base",
        repo_dir: "json-repo",
        patches_dir: "json-patches",
        ref: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];
    const env = {
      PATCHY_REPO_URL: "https://github.com/example/env-repo.git",
      PATCHY_REPO_BASE_DIR: "env-base",
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
        "repo_base_dir": "env-base",
        "patches_dir": "env-patches",
        "ref": "env-branch",
        "verbose": true,
        "dry_run": false,
        "config": "./patchy.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/env-base",
        "absoluteRepoDir": "<TEST_DIR>/env-base/env-repo",
        "absolutePatchesDir": "<TEST_DIR>/env-patches"
      }"
    `,
    );
  });

  it("should use PATCHY_CONFIG env var for config path", async () => {
    const customConfigDir = path.join(tmpDir, "custom-env");
    const customConfigPath = path.join(customConfigDir, "env-config.json");
    mkdirSync(customConfigDir, { recursive: true });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {},
    });

    writeFileSync(
      customConfigPath,
      JSON.stringify(
        {
          repo_url: "https://github.com/example/env-config.git",
          repo_base_dir: "base",
          repo_dir: "repo",
          ref: "env-config-branch",
        },
        null,
        2,
      ),
    );

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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
        "repo_base_dir": "base",
        "patches_dir": "./patches/",
        "ref": "env-config-branch",
        "verbose": false,
        "dry_run": false,
        "config": "<TEST_DIR>/custom-env/env-config.json",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
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
        repoBaseDir: "base",
        repoDir: "repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
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
        requiredFields: ["repo_url", "repo_base_dir", "repo_dir"],
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
        repoBaseDir: "json-base",
        repoDir: "json-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/json-repo.git",
        repo_base_dir: "json-base",
        repo_dir: "json-repo",
        ref: "json-ref",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: JsonConfigKey[] = [
      "repo_url",
      "repo_base_dir",
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

describe("parseOptionalJsonConfig", () => {
  it("should parse valid config successfully", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        ref: "main",
        verbose: true,
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        repo_url: "https://github.com/user/repo.git",
        ref: "main",
        verbose: true,
      });
    }
  });

  it("should return empty object for undefined input", () => {
    const result = parseOptionalJsonConfig(undefined);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it("should handle empty string fields with custom error messages", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "",
        ref: "",
        repo_base_dir: "",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "repo_url: Repository URL is required
        repo_base_dir: Repository base directory is required
        ref: Git reference is required"
      `);
    }
  });

  it("should fail with type errors for wrong field types", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: 123,
        verbose: "not-a-boolean",
        ref: ["array", "not", "string"],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchInlineSnapshot(`
        "repo_url: Invalid input: expected string, received number
        ref: Invalid input: expected string, received array
        verbose: Invalid input: expected boolean, received string"
      `);
    }
  });

  it("should fail with strict mode error for unknown fields", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        unknown_field: "value",
        another_unknown: 123,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unrecognized key");
    }
  });

  it("should reject dry_run in JSON config (runtime-only flag)", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        dry_run: true,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unrecognized key: "dry_run"');
    }
  });

  it("should handle all valid optional fields", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: "https://github.com/user/repo.git",
        ref: "develop",
        repo_base_dir: "/home/user/repos",
        repo_dir: "my-repo",
        patches_dir: "./patches",
        verbose: false,
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        repo_url: "https://github.com/user/repo.git",
        ref: "develop",
        repo_base_dir: "/home/user/repos",
        repo_dir: "my-repo",
        patches_dir: "./patches",
        verbose: false,
      });
    }
  });

  it("should handle JSON parsing errors", () => {
    const result = parseOptionalJsonConfig("{ invalid json");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("JSON parse error");
      expect(result.error).toContain("invalid json");
    }
  });

  it("should handle null values as invalid types", () => {
    const result = parseOptionalJsonConfig(
      JSON.stringify({
        repo_url: null,
        verbose: null,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "repo_url: Invalid input: expected string, received null",
      );
      expect(result.error).toContain(
        "verbose: Invalid input: expected boolean, received null",
      );
    }
  });
});
