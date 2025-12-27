import { describe, expect, it } from "bun:test";
import type { EnrichedMergedConfig } from "~/cli-fields/types";
import { type ConfigKey, getConfigValue } from "./keys";

describe("getConfigValue", () => {
  const createMockConfig = (
    overrides: Partial<EnrichedMergedConfig> = {},
  ): EnrichedMergedConfig => ({
    source_repo: "https://github.com/example/repo.git",
    target_repo: "my-repo",
    clones_dir: "./clones",
    patches_dir: "./patches",
    patch_set: "feature-set",
    base_revision: "v1.0.0",
    upstream_branch: "main",
    hook_prefix: "patchy-",
    verbose: false,
    dry_run: false,
    config: "./patchy.json",
    absoluteClonesDir: "/home/user/project/clones",
    absoluteTargetRepo: "/home/user/project/clones/my-repo",
    absolutePatchesDir: "/home/user/project/patches",
    absolutePatchSetDir: "/home/user/project/patches/feature-set",
    ...overrides,
  });

  it("returns string value for raw key", () => {
    const config = createMockConfig();
    expect(getConfigValue(config, "source_repo")).toBe(
      "https://github.com/example/repo.git",
    );
    expect(getConfigValue(config, "target_repo")).toBe("my-repo");
    expect(getConfigValue(config, "clones_dir")).toBe("./clones");
    expect(getConfigValue(config, "patch_set")).toBe("feature-set");
  });

  it("returns absolute path for computed key", () => {
    const config = createMockConfig();
    expect(getConfigValue(config, "clones_dir_path")).toBe(
      "/home/user/project/clones",
    );
    expect(getConfigValue(config, "target_repo_path")).toBe(
      "/home/user/project/clones/my-repo",
    );
    expect(getConfigValue(config, "patches_dir_path")).toBe(
      "/home/user/project/patches",
    );
    expect(getConfigValue(config, "patch_set_path")).toBe(
      "/home/user/project/patches/feature-set",
    );
  });

  it("converts boolean false to 'false' string", () => {
    const config = createMockConfig({ verbose: false });
    expect(getConfigValue(config, "verbose")).toBe("false");
  });

  it("converts boolean true to 'true' string", () => {
    const config = createMockConfig({ verbose: true });
    expect(getConfigValue(config, "verbose")).toBe("true");
  });

  it("returns undefined for missing values", () => {
    const config = createMockConfig({
      patch_set: undefined,
      absolutePatchSetDir: undefined,
      absoluteTargetRepo: undefined,
    });
    expect(getConfigValue(config, "patch_set")).toBeUndefined();
    expect(getConfigValue(config, "patch_set_path")).toBeUndefined();
    expect(getConfigValue(config, "target_repo_path")).toBeUndefined();
  });

  it("handles all raw keys", () => {
    const config = createMockConfig();
    const rawKeys: ConfigKey[] = [
      "source_repo",
      "target_repo",
      "clones_dir",
      "patches_dir",
      "patch_set",
      "base_revision",
      "upstream_branch",
      "hook_prefix",
      "verbose",
    ];
    for (const key of rawKeys) {
      expect(getConfigValue(config, key)).toBeDefined();
    }
  });

  it("handles all computed keys", () => {
    const config = createMockConfig();
    const computedKeys: ConfigKey[] = [
      "clones_dir_path",
      "target_repo_path",
      "patches_dir_path",
      "patch_set_path",
    ];
    for (const key of computedKeys) {
      expect(getConfigValue(config, key)).toBeDefined();
    }
  });
});
