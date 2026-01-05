import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  generateTmpDir,
  getStabilizedJson,
  setupTestWithConfig,
  stabilizeTempDir,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/fs-test-utils";
import type { NarrowedConfig } from "./narrowing";
import {
  REQUIRE_PATCHES_DIR,
  REQUIRE_SOURCE_REPO,
  REQUIRE_TARGET_REPO,
  type RequirementPattern,
} from "./requirement-patterns";
import { createEnrichedMergedConfig } from "./resolver";
import type { EnrichedMergedConfig, JsonConfigKey, SharedFlags } from "./types";

const makePattern = (
  fields: JsonConfigKey[],
): RequirementPattern<keyof EnrichedMergedConfig> => ({
  validate: fields,
  guarantees: fields as (keyof EnrichedMergedConfig)[],
});

const expectSuccessfulMerge: <
  P extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
>(
  result: ReturnType<typeof createEnrichedMergedConfig<P>>,
) => asserts result is { success: true; mergedConfig: NarrowedConfig<P> } = (
  result,
) => {
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.mergedConfig).toBeDefined();
  }
};

const expectFailedMerge: <
  P extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
>(
  result: ReturnType<typeof createEnrichedMergedConfig<P>>,
) => asserts result is { success: false; error: string } = (result) => {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBeDefined();
  }
};

describe("createEnrichedMergedConfig", () => {
  it("should merge JSON config with CLI flags successfully", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "clonesDir1",
        targetRepo: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/test-repo.git",
        clones_dir: "clonesDir1",
        target_repo: "repoDir1",
        base_revision: "main",
        verbose: true,
      },
    });

    const flags: SharedFlags = {
      "source-repo": "https://github.com/example/flag-repo.git",
      "dry-run": true,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/flag-repo.git",
          "source": "flag"
        },
        "target_repo": {
          "value": "repoDir1",
          "source": "config"
        },
        "clones_dir": {
          "value": "clonesDir1",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "config"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "config"
        },
        "dry_run": {
          "value": true,
          "source": "flag"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/clonesDir1",
        "absoluteTargetRepo": "<TEST_DIR>/clonesDir1/repoDir1",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
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

    const flags: SharedFlags = {
      "dry-run": true,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO, REQUIRE_TARGET_REPO],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Source repository: set source_repo in ./patchy.json, PATCHY_SOURCE_REPO env var, or --source-repo flag
        Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

      You can set up ./patchy.json by running:
        patchy init

      "
    `);
  });

  it("should use default values when not specified", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "clonesDir1",
        targetRepo: "repoDir1",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "clonesDir1",
        target_repo: "repoDir1",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repoDir1",
          "source": "config"
        },
        "clones_dir": {
          "value": "clonesDir1",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/clonesDir1",
        "absoluteTargetRepo": "<TEST_DIR>/clonesDir1/repoDir1",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should throw error when config file doesn't exist with explicit path", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    const flags: SharedFlags = {
      config: "./non-existent-config.json",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-config.json"`,
    );
  });

  it("should throw error on invalid JSON", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "invalid.json", "{ invalid json: content }");
    const invalidJsonPath = path.join(tmpDir, "invalid.json");

    const flags: SharedFlags = {
      config: invalidJsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
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

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
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
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "flag-base",
        targetRepo: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/test-repo.git",
        clones_dir: "json-base",
        target_repo: "json-repo",
        patches_dir: "json-patches",
        base_revision: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {
      "source-repo": "https://github.com/example/flag-repo.git",
      "clones-dir": "flag-base",
      "target-repo": "flag-repo",
      "patches-dir": "flag-patches",
      "base-revision": "flag-ref",
      verbose: true,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/flag-repo.git",
          "source": "flag"
        },
        "target_repo": {
          "value": "flag-repo",
          "source": "flag"
        },
        "clones_dir": {
          "value": "flag-base",
          "source": "flag"
        },
        "patches_dir": {
          "value": "flag-patches",
          "source": "flag"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "flag-ref",
          "source": "flag"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "flag"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/flag-base",
        "absoluteTargetRepo": "<TEST_DIR>/flag-base/flag-repo",
        "absolutePatchesDir": "<TEST_DIR>/flag-patches"
      }"
    `,
    );
  });

  it("should correctly resolve absolute paths", async () => {
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
        patches_dir: "patches",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "patches",
          "source": "config"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteTargetRepo": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle empty JSON config file", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "empty.json", "{}");
    const emptyJsonPath = path.join(tmpDir, "empty.json");

    const flags: SharedFlags = {
      config: emptyJsonPath,
      "source-repo": "https://github.com/example/repo.git",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "flag"
        },
        "target_repo": {
          "source": "default"
        },
        "clones_dir": {
          "value": "./clones/",
          "source": "default"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "<TEST_DIR>/empty.json",
          "source": "flag"
        },
        "absoluteClonesDir": "<TEST_DIR>/clones",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle truly empty config file (no content)", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "truly-empty.json", "");
    const emptyJsonPath = path.join(tmpDir, "truly-empty.json");

    const flags: SharedFlags = {
      config: emptyJsonPath,
      "source-repo": "https://github.com/example/repo.git",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
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
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [makePattern(["clones_dir"]), REQUIRE_PATCHES_DIR],
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
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
        verbose: false,
      },
    });

    const flags: SharedFlags = {
      verbose: true,
      "dry-run": true,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "flag"
        },
        "dry_run": {
          "value": true,
          "source": "flag"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteTargetRepo": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should correctly join clones_dir and target_repo paths", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "my-base/nested",
        targetRepo: "my-repo/nested-repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "my-base/nested",
        target_repo: "my-repo/nested-repo",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "my-repo/nested-repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "my-base/nested",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/my-base/nested",
        "absoluteTargetRepo": "<TEST_DIR>/my-base/nested/my-repo/nested-repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
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
      },
      jsonConfig: {
        source_repo: "https://github.com/example/custom.git",
        clones_dir: "base",
        target_repo: "repo",
        base_revision: "custom-branch",
      },
    });

    const flags: SharedFlags = {
      config: customConfigPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/custom.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "custom-branch",
          "source": "config"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "<TEST_DIR>/custom/config.json",
          "source": "flag"
        },
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteTargetRepo": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle working directory changes with cwd parameter", async () => {
    const tmpDir = generateTmpDir();
    const subDir = path.join(tmpDir, "subdir");
    await setupTestWithConfig({
      tmpDir: subDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
      },
    });

    const flags: SharedFlags = {};

    const originalCwd = process.cwd();
    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: subDir,
    });

    expectSuccessfulMerge(result);
    expect(process.cwd()).toBe(originalCwd);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/subdir/base",
        "absoluteTargetRepo": "<TEST_DIR>/subdir/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/subdir/patches"
      }"
    `,
    );
  });

  it("should restore process working directory after execution", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
      },
    });

    const flags: SharedFlags = {};
    const originalCwd = process.cwd();

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(process.cwd()).toBe(originalCwd);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/repo.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "main",
          "source": "default"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteTargetRepo": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should handle Zod validation errors for invalid JSON structure", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "invalid-structure.json", {
      source_repo: 123,
      verbose: "not-a-boolean",
      base_revision: ["array", "not", "string"],
    });
    const invalidJsonPath = path.join(tmpDir, "invalid-structure.json");

    const flags: SharedFlags = {
      config: invalidJsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toContain("Invalid input");
  });

  it("should fail validation when repo URL is invalid", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "invalid-url-format",
        clones_dir: "base",
        target_repo: "repo",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["clones_dir"]),
        REQUIRE_SOURCE_REPO,
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      source_repo: invalid-url-format in ./patchy.json is invalid. Example: https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo

      "
    `);
  });

  it("should handle empty string fields (now accepted by schema)", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "empty-strings.json", {
      source_repo: "",
      base_revision: "",
      clones_dir: "",
    });
    const jsonPath = path.join(tmpDir, "empty-strings.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    // Empty strings are now accepted by schema (since requiredInConfig: false)
    // Config values override defaults, so empty strings take precedence
    expectSuccessfulMerge(result);
    expect(result.mergedConfig.source_repo.value).toBe("");
    expect(result.mergedConfig.base_revision.value).toBe("");
    expect(result.mergedConfig.clones_dir.value).toBe("");
  });

  it("should handle Zod validation error for null values", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "null-values.json", {
      source_repo: null,
      verbose: null,
      patches_dir: null,
    });
    const jsonPath = path.join(tmpDir, "null-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
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
    const jsonPath = path.join(tmpDir, "unknown-fields.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(
      `"Unrecognized keys: "unknown_field", "another_unknown""`,
    );
  });

  it("should handle boolean field with string value", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "boolean-string.json", {
      verbose: "yes",
      dry_run: "true",
    });
    const jsonPath = path.join(tmpDir, "boolean-string.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should handle array values where strings are expected", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "array-values.json", {
      source_repo: ["https://github.com/user/repo.git"],
      base_revision: ["main", "develop"],
      patches_dir: ["./patches"],
    });
    const jsonPath = path.join(tmpDir, "array-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received array
      base_revision: Invalid input: expected string, received array"
    `);
  });

  it("should handle object values where primitives are expected", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "object-values.json", {
      source_repo: { url: "https://github.com/user/repo.git" },
      verbose: { enabled: true },
    });
    const jsonPath = path.join(tmpDir, "object-values.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received object
      verbose: Invalid input: expected boolean, received object"
    `);
  });

  it("should handle multiple Zod errors with mixed types", async () => {
    const tmpDir = generateTmpDir();
    await writeJsonConfig(tmpDir, "mixed-errors.json", {
      source_repo: 123,
      base_revision: true,
      clones_dir: ["base"],
      target_repo: null,
      patches_dir: {},
      verbose: "false",
      dry_run: 1,
    });
    const jsonPath = path.join(tmpDir, "mixed-errors.json");

    const flags: SharedFlags = {
      config: jsonPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [],
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(result.error).toMatchInlineSnapshot(`
      "source_repo: Invalid input: expected string, received number
      target_repo: Invalid input: expected string, received null
      clones_dir: Invalid input: expected string, received array
      patches_dir: Invalid input: expected string, received object
      base_revision: Invalid input: expected string, received boolean
      verbose: Invalid input: expected boolean, received string
      Unrecognized key: "dry_run""
    `);
  });

  it("should use environment variables when flags and JSON are not set", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "env-base",
        targetRepo: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {};
    const env = {
      PATCHY_SOURCE_REPO: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_TARGET_REPO: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_BASE_REVISION: "env-branch",
      PATCHY_VERBOSE: "true",
      PATCHY_DRY_RUN: "1",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/env-repo.git",
          "source": "env"
        },
        "target_repo": {
          "value": "env-repo",
          "source": "env"
        },
        "clones_dir": {
          "value": "env-base",
          "source": "env"
        },
        "patches_dir": {
          "value": "env-patches",
          "source": "env"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "env-branch",
          "source": "env"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "env"
        },
        "dry_run": {
          "value": true,
          "source": "env"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/env-base",
        "absoluteTargetRepo": "<TEST_DIR>/env-base/env-repo",
        "absolutePatchesDir": "<TEST_DIR>/env-patches"
      }"
    `,
    );
  });

  it("should prioritize CLI flags over environment variables", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "flag-base",
        targetRepo: "flag-repo",
        patchesDir: "flag-patches",
      },
      jsonConfig: {},
    });

    const flags: SharedFlags = {
      "source-repo": "https://github.com/example/flag-repo.git",
      "clones-dir": "flag-base",
      "target-repo": "flag-repo",
      "patches-dir": "flag-patches",
      "base-revision": "flag-ref",
      verbose: true,
      "dry-run": true,
    };
    const env = {
      PATCHY_SOURCE_REPO: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_TARGET_REPO: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_BASE_REVISION: "env-branch",
      PATCHY_VERBOSE: "false",
      PATCHY_DRY_RUN: "false",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/flag-repo.git",
          "source": "flag"
        },
        "target_repo": {
          "value": "flag-repo",
          "source": "flag"
        },
        "clones_dir": {
          "value": "flag-base",
          "source": "flag"
        },
        "patches_dir": {
          "value": "flag-patches",
          "source": "flag"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "flag-ref",
          "source": "flag"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "flag"
        },
        "dry_run": {
          "value": true,
          "source": "flag"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/flag-base",
        "absoluteTargetRepo": "<TEST_DIR>/flag-base/flag-repo",
        "absolutePatchesDir": "<TEST_DIR>/flag-patches"
      }"
    `,
    );
  });

  it("should prioritize environment variables over JSON config", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "env-base",
        targetRepo: "env-repo",
        patchesDir: "env-patches",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/json-repo.git",
        clones_dir: "json-base",
        target_repo: "json-repo",
        patches_dir: "json-patches",
        base_revision: "json-ref",
        verbose: false,
      },
    });

    const flags: SharedFlags = {};
    const env = {
      PATCHY_SOURCE_REPO: "https://github.com/example/env-repo.git",
      PATCHY_CLONES_DIR: "env-base",
      PATCHY_TARGET_REPO: "env-repo",
      PATCHY_PATCHES_DIR: "env-patches",
      PATCHY_BASE_REVISION: "env-branch",
      PATCHY_VERBOSE: "true",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
        REQUIRE_PATCHES_DIR,
      ],
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/env-repo.git",
          "source": "env"
        },
        "target_repo": {
          "value": "env-repo",
          "source": "env"
        },
        "clones_dir": {
          "value": "env-base",
          "source": "env"
        },
        "patches_dir": {
          "value": "env-patches",
          "source": "env"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "env-branch",
          "source": "env"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": true,
          "source": "env"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "./patchy.json",
          "source": "default"
        },
        "absoluteClonesDir": "<TEST_DIR>/env-base",
        "absoluteTargetRepo": "<TEST_DIR>/env-base/env-repo",
        "absolutePatchesDir": "<TEST_DIR>/env-patches"
      }"
    `,
    );
  });

  it("should use PATCHY_CONFIG env var for config path", async () => {
    const tmpDir = generateTmpDir();
    const customConfigPath = path.join(tmpDir, "custom-env", "env-config.json");

    await setupTestWithConfig({
      tmpDir,
      configPath: customConfigPath,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/env-config.git",
        clones_dir: "base",
        target_repo: "repo",
        base_revision: "env-config-branch",
      },
    });

    const flags: SharedFlags = {};
    const env = {
      PATCHY_CONFIG: customConfigPath,
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "source_repo": {
          "value": "https://github.com/example/env-config.git",
          "source": "config"
        },
        "target_repo": {
          "value": "repo",
          "source": "config"
        },
        "clones_dir": {
          "value": "base",
          "source": "config"
        },
        "patches_dir": {
          "value": "./patches/",
          "source": "default"
        },
        "patch_set": {
          "source": "default"
        },
        "base_revision": {
          "value": "env-config-branch",
          "source": "config"
        },
        "upstream_branch": {
          "source": "default"
        },
        "hook_prefix": {
          "value": "patchy-",
          "source": "default"
        },
        "verbose": {
          "value": false,
          "source": "config"
        },
        "dry_run": {
          "value": false,
          "source": "default"
        },
        "config": {
          "value": "<TEST_DIR>/custom-env/env-config.json",
          "source": "env"
        },
        "absoluteClonesDir": "<TEST_DIR>/base",
        "absoluteTargetRepo": "<TEST_DIR>/base/repo",
        "absolutePatchesDir": "<TEST_DIR>/patches"
      }"
    `,
    );
  });

  it("should fail when PATCHY_CONFIG env var points to non-existent file", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });

    const flags: SharedFlags = {};
    const env = {
      PATCHY_CONFIG: "./non-existent-env-config.json",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
      cwd: tmpDir,
      env,
    });

    expectFailedMerge(result);
    expect(stabilizeTempDir(result.error)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-env-config.json"`,
    );
  });

  it("should handle boolean env vars with different truthy values", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "base",
        targetRepo: "repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        clones_dir: "base",
        target_repo: "repo",
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
        requires: [
          makePattern(["source_repo", "clones_dir"]),
          REQUIRE_TARGET_REPO,
        ],
        cwd: tmpDir,
        env: { PATCHY_VERBOSE, PATCHY_DRY_RUN },
      });

      expectSuccessfulMerge(result);
      expect(result.mergedConfig.verbose.value).toBe(expectedVerbose);
      expect(result.mergedConfig.dry_run.value).toBe(expectedDryRun);
    }
  });

  it("should ignore empty string env vars", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "json-base",
        targetRepo: "json-repo",
      },
      jsonConfig: {
        source_repo: "https://github.com/example/json-repo.git",
        clones_dir: "json-base",
        target_repo: "json-repo",
        base_revision: "json-ref",
      },
    });

    const flags: SharedFlags = {};
    const env = {
      PATCHY_SOURCE_REPO: "",
      PATCHY_BASE_REVISION: "",
    };

    const result = createEnrichedMergedConfig({
      flags,
      requires: [
        makePattern(["source_repo", "clones_dir"]),
        REQUIRE_TARGET_REPO,
      ],
      cwd: tmpDir,
      env,
    });

    expectSuccessfulMerge(result);
    expect(result.mergedConfig.source_repo.value).toBe(
      "https://github.com/example/json-repo.git",
    );
    expect(result.mergedConfig.base_revision.value).toBe("json-ref");
  });

  it("should use absolute target_repo directly without clones_dir", async () => {
    const tmpDir = generateTmpDir();
    const absoluteRepoPath = path.join(tmpDir, "absolute-repo");
    mkdirSync(absoluteRepoPath, { recursive: true });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        target_repo: absoluteRepoPath,
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO, REQUIRE_TARGET_REPO],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(result.mergedConfig.absoluteTargetRepo).toBe(absoluteRepoPath);
    expect(result.mergedConfig.absoluteClonesDir).toBeDefined();
  });

  it("should use tilde target_repo directly without clones_dir", async () => {
    const tmpDir = generateTmpDir();

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        source_repo: "https://github.com/example/repo.git",
        target_repo: "~/some-repo-that-may-not-exist",
      },
    });

    const flags: SharedFlags = {};

    const result = createEnrichedMergedConfig({
      flags,
      requires: [REQUIRE_SOURCE_REPO],
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(result.mergedConfig.absoluteTargetRepo).toBe(
      path.join(os.homedir(), "some-repo-that-may-not-exist"),
    );
  });
});
