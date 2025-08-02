import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMergedConfig } from "../config/resolver";
import type { SharedFlags, YamlKey } from "../config/types";
import {
  generateTmpDir,
  setupTestWithConfig,
  stableizeTempDir,
} from "../e2e/test-utils";

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

    expect(result.error).toBeUndefined();

    expect(result.success).toBe(true);
    expect(
      stableizeTempDir(JSON.stringify(result.mergedConfig, null, 2)),
    ).toMatchInlineSnapshot(
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
});
