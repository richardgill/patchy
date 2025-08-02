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
});
