import dedent from "dedent";
import { describe, expect, it } from "vitest";
import { createMergedConfig } from "~/config/resolver";
import type { SharedFlags, YamlKey } from "~/config/types";

describe("createMergedConfig", () => {
  it("should merge YAML config with CLI flags successfully", () => {
    const yamlString = dedent`
      repo_url: https://github.com/example/yaml-repo.git
      repo_base_dir: yaml-base
      repo_dir: yaml-dir
      ref: yaml-branch
      verbose: true
    `.trim();

    const flags: SharedFlags = {
      "repo-url": "https://github.com/example/flag-repo.git",
      "patches-dir": "flag-patches",
      "dry-run": true,
    };

    const requiredFields: YamlKey[] = ["repo_url", "repo_base_dir", "repo_dir"];

    const result = createMergedConfig({
      yamlString,
      flags,
      requiredFields,
      configPath: "test-config.yaml",
      configPathFlag: undefined,
      cwd: "/test/cwd",
    });

    expect(result.success).toBe(true);
    expect(result.mergedConfig).toMatchInlineSnapshot(`
      {
        "absolutePatchesDir": "/test/cwd/flag-patches",
        "absoluteRepoBaseDir": "/test/cwd/yaml-base",
        "absoluteRepoDir": "/test/cwd/yaml-base/yaml-dir",
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
