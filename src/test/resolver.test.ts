import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMergedConfig } from "../config/resolver";
import type { SharedFlags, YamlKey } from "../config/types";
import {
  generateTmpDir,
  getStabilizedJson,
  setupTestWithConfig,
  stableizeTempDir,
} from "../e2e/test-utils";

const expectSuccessfulMerge = (
  result: ReturnType<typeof createMergedConfig>,
) => {
  expect(result.error).toBeUndefined();
  expect(result.success).toBe(true);
};

const expectFailedMerge = (result: ReturnType<typeof createMergedConfig>) => {
  expect(result.error).toBeDefined();
  expect(result.success).toBe(false);
};

describe("createMergedConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  afterEach(async () => {
    // await cleanupTmpDir(tmpDir);
  });

  it("should merge YAML config with CLI flags successfully", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repoBaseDir1",
        repoDir: "repoDir1",
        patchesDir: "patches",
      },
      yamlConfig: {
        repo_url: "https://github.com/example/yaml-repo.git",
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

    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/flag-repo.git",
        "ref": "main",
        "repo_base_dir": "repoBaseDir1",
        "absoluteRepoBaseDir": "<TEST_DIR>/repoBaseDir1",
        "repo_dir": "repoDir1",
        "absoluteRepoDir": "<TEST_DIR>/repoBaseDir1/repoDir1",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": true,
        "dry_run": true
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
      yamlConfig: {
        verbose: true,
      },
    });

    const flags: SharedFlags = {
      "dry-run": true,
    };

    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stableizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository URL: set repo_url in ./patchy.yaml or use --repo-url flag
        Missing Repository base directory: set repo_base_dir in ./patchy.yaml or use --repo-base-dir flag
        Missing Repository directory: set repo_dir in ./patchy.yaml or use --repo-dir flag

      You can set up ./patchy.yaml by running:
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
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "repoBaseDir1",
        repo_dir: "repoDir1",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "repoBaseDir1",
        "absoluteRepoBaseDir": "<TEST_DIR>/repoBaseDir1",
        "repo_dir": "repoDir1",
        "absoluteRepoDir": "<TEST_DIR>/repoBaseDir1/repoDir1",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should throw error when config file doesn't exist with explicit path", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const flags: SharedFlags = {
      config: "./non-existent-config.yaml",
    };
    const requiredFields: YamlKey[] = ["repo_url"];

    let errorMessage = "";
    try {
      createMergedConfig({
        flags,
        requiredFields,
        cwd: tmpDir,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(stableizeTempDir(errorMessage)).toMatchInlineSnapshot(
      `"Configuration file not found: <TEST_DIR>/non-existent-config.yaml"`,
    );
  });

  it("should throw error on invalid YAML", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const invalidYamlPath = path.join(tmpDir, "invalid.yaml");
    writeFileSync(invalidYamlPath, "invalid: yaml: content: [\n");

    const flags: SharedFlags = {
      config: invalidYamlPath,
    };
    const requiredFields: YamlKey[] = ["repo_url"];

    let errorMessage = "";
    try {
      createMergedConfig({
        flags,
        requiredFields,
        cwd: tmpDir,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toMatchInlineSnapshot(
      `"Nested mappings are not allowed in compact mappings at line 1, column 10:\n\ninvalid: yaml: content: [\n         ^\n"`,
    );
  });

  it("should fail validation when directories don't exist", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "non-existent-base",
        repo_dir: "non-existent-repo",
        patches_dir: "non-existent-patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stableizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      repo_base_dir: non-existent-base in ./patchy.yaml does not exist: <TEST_DIR>/non-existent-base
      patches_dir: non-existent-patches in ./patchy.yaml does not exist: <TEST_DIR>/non-existent-patches

      "
    `);
  });

  it("should prioritize CLI flags over YAML values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "flag-base",
        repoDir: "flag-repo",
        patchesDir: "flag-patches",
      },
      yamlConfig: {
        repo_url: "https://github.com/example/yaml-repo.git",
        repo_base_dir: "yaml-base",
        repo_dir: "yaml-repo",
        patches_dir: "yaml-patches",
        ref: "yaml-ref",
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
    const requiredFields: YamlKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/flag-repo.git",
        "ref": "flag-ref",
        "repo_base_dir": "flag-base",
        "absoluteRepoBaseDir": "<TEST_DIR>/flag-base",
        "repo_dir": "flag-repo",
        "absoluteRepoDir": "<TEST_DIR>/flag-base/flag-repo",
        "patches_dir": "flag-patches",
        "absolutePatchesDir": "<TEST_DIR>/flag-patches",
        "verbose": true,
        "dry_run": false
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
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        patches_dir: "patches",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = [
      "repo_url",
      "repo_base_dir",
      "repo_dir",
      "patches_dir",
    ];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "patches_dir": "patches",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should handle empty YAML config file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyYamlPath = path.join(tmpDir, "empty.yaml");
    writeFileSync(emptyYamlPath, "{}");

    const flags: SharedFlags = {
      config: emptyYamlPath,
      "repo-url": "https://github.com/example/repo.git",
    };
    const requiredFields: YamlKey[] = ["repo_url"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should handle empty YAML config file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyYamlPath = path.join(tmpDir, "truly-empty.yaml");
    writeFileSync(emptyYamlPath, "");

    const flags: SharedFlags = {
      config: emptyYamlPath,
      "repo-url": "https://github.com/example/repo.git",
    };
    const requiredFields: YamlKey[] = ["repo_url"];

    let errorMessage = "";
    try {
      createMergedConfig({
        flags,
        requiredFields,
        cwd: tmpDir,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toMatchInlineSnapshot(
      `"[\n  {\n    \"expected\": \"object\",\n    \"code\": \"invalid_type\",\n    \"path\": [],\n    \"message\": \"Invalid input: expected object, received null\"\n  }\n]"`,
    );
  });

  it("should handle different combinations of missing required fields", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_base_dir", "patches_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stableizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.yaml or use --repo-base-dir flag

      You can set up ./patchy.yaml by running:
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
      yamlConfig: {
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
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": true,
        "dry_run": true
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
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "my-base/nested",
        repo_dir: "my-repo/nested-repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "my-base/nested",
        "absoluteRepoBaseDir": "<TEST_DIR>/my-base/nested",
        "repo_dir": "my-repo/nested-repo",
        "absoluteRepoDir": "<TEST_DIR>/my-base/nested/my-repo/nested-repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should use custom config path", async () => {
    const customConfigDir = path.join(tmpDir, "custom");
    const customConfigPath = path.join(customConfigDir, "config.yaml");
    mkdirSync(customConfigDir, { recursive: true });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
      },
      yamlConfig: {
        repo_url: "https://github.com/example/custom.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        ref: "custom-branch",
      },
    });

    writeFileSync(
      customConfigPath,
      "repo_url: https://github.com/example/custom.git\nrepo_base_dir: base\nrepo_dir: repo\nref: custom-branch",
    );

    const flags: SharedFlags = {
      config: customConfigPath,
    };
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectSuccessfulMerge(result);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/custom.git",
        "ref": "custom-branch",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
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
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const originalCwd = process.cwd();
    const result = createMergedConfig({
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
        "ref": "main",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/subdir/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/subdir/base/repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/subdir/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should call onConfigMerged callback with merged config", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
      },
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];
    let callbackConfig: any = null;

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
      onConfigMerged: (config) => {
        callbackConfig = config;
      },
    });

    expectSuccessfulMerge(result);
    expect(callbackConfig).not.toBeNull();
    expect(getStabilizedJson(callbackConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
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
      yamlConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];
    const originalCwd = process.cwd();

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expect(process.cwd()).toBe(originalCwd);
    expect(getStabilizedJson(result.mergedConfig)).toMatchInlineSnapshot(
      `
      "{
        "repo_url": "https://github.com/example/repo.git",
        "ref": "main",
        "repo_base_dir": "base",
        "absoluteRepoBaseDir": "<TEST_DIR>/base",
        "repo_dir": "repo",
        "absoluteRepoDir": "<TEST_DIR>/base/repo",
        "patches_dir": "./patches/",
        "absolutePatchesDir": "<TEST_DIR>/patches",
        "verbose": false,
        "dry_run": false
      }"
    `,
    );
  });

  it("should handle Zod validation errors for invalid YAML structure", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const invalidYamlPath = path.join(tmpDir, "invalid-structure.yaml");
    writeFileSync(
      invalidYamlPath,
      "repo_url: 123\nverbose: 'not-a-boolean'\nref: [array, not, string]",
    );

    const flags: SharedFlags = {
      config: invalidYamlPath,
    };
    const requiredFields: YamlKey[] = ["repo_url"];

    let errorMessage = "";
    try {
      createMergedConfig({
        flags,
        requiredFields,
        cwd: tmpDir,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toContain("Invalid input");
  });

  it("should fail validation when repo URL is invalid", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
      },
      yamlConfig: {
        repo_url: "invalid-url-format",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const flags: SharedFlags = {};
    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    expectFailedMerge(result);
    expect(stableizeTempDir(result.error)).toMatchInlineSnapshot(`
      "Validation errors:

      repo_url: invalid-url-format in ./patchy.yaml is invalid.  Example repo: https://github.com/user/repo.git

      "
    `);
  });
});
