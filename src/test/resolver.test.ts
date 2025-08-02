import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMergedConfig } from "../config/resolver";
import type { SharedFlags, YamlKey } from "../config/types";
import { cleanupTmpDir, createTmpDir } from "../e2e/test-utils";

describe("createMergedConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTmpDir(tmpDir);
  });

  it("should merge YAML config with CLI flags successfully", () => {
    const configPath = join(tmpDir, "patchy.yaml");
    const yamlContent = `repo_url: https://github.com/example/yaml-repo.git
repo_base_dir: yaml-base
repo_dir: yaml-dir
ref: yaml-branch
verbose: true`;

    writeFileSync(configPath, yamlContent);

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "patches-dir": "flag-patches",
      "dry-run": true,
      config: configPath,
    };

    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      flags,
      requiredFields,
      cwd: tmpDir,
    });

    console.log("Result:", result);
    if (!result.success) {
      console.log("Error:", result.error);
    }

    expect(result.success).toBe(true);
    expect(result.mergedConfig).toMatchInlineSnapshot(`
      {
        "absolutePatchesDir": "${tmpDir}/flag-patches",
        "absoluteRepoBaseDir": "${tmpDir}/yaml-base",
        "absoluteRepoDir": "${tmpDir}/yaml-base/yaml-dir",
        "dry_run": true,
        "patches_dir": "flag-patches",
        "ref": "yaml-branch",
        "repo_base_dir": "yaml-base",
        "repo_dir": "yaml-dir",
        "repo_url": "https://github.com/example/flag-repo.git",
        "verbose": true,
      }
    `);
  });
});
