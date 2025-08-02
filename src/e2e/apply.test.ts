import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertFailedCommand,
  assertSuccessfulCommand,
  cleanupTestDir,
  createTestDir,
  stabilizeTempDir,
  type TestContext,
  writeTestConfig,
} from "./test-utils";

describe("patchy apply", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(ctx);
  });

  const setupConfigFile = async (
    config: Record<string, string | boolean | number>,
  ) => {
    const configPath = join(ctx.patchesDir, "patchy.yaml");
    await writeTestConfig(configPath, config);
  };

  it("should apply patches with all flags specified", async () => {
    await setupConfigFile({
      repo_url: "https://github.com/example/test-repo.git",
      repo_dir: "config-repo",
    });

    const result = await assertSuccessfulCommand(
      `apply --repo-dir main --repo-base-dir ${ctx.repoBaseDir} --patches-dir patches --config patchy.yaml --verbose --dry-run`,
      ctx.patchesDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/test-repo.git
        repo_dir: main
        repo_base_dir: <TEST_DIR>/repos
        patches_dir: patches
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from patches to main"
    `);
  });

  it("should apply patches using config file values", async () => {
    await setupConfigFile({
      repo_url: "https://github.com/example/test-repo.git",
      repo_dir: "upstream",
      repo_base_dir: ctx.repoBaseDir,
      patches_dir: "my-patches",
      ref: "main",
    });

    const result = await assertSuccessfulCommand(
      `apply --dry-run`,
      ctx.patchesDir,
    );

    expect(result.stdout).toMatchInlineSnapshot(
      `"[DRY RUN] Would apply patches from my-patches to upstream"`,
    );
  });

  it("should override config file values with CLI flags", async () => {
    await setupConfigFile({
      repo_url: "https://github.com/example/test-repo.git",
      repo_dir: "config-repo",
      repo_base_dir: ctx.repoBaseDir,
      patches_dir: "config-patches",
      ref: "main",
    });

    const result = await assertSuccessfulCommand(
      `apply --repo-dir cli-repo --patches-dir cli-patches --dry-run`,
      ctx.patchesDir,
    );

    expect(result.stdout).toMatchInlineSnapshot(
      `"[DRY RUN] Would apply patches from cli-patches to cli-repo"`,
    );
  });

  describe("error cases", () => {
    it("should fail when repo_url is missing", async () => {
      await setupConfigFile({
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
      });

      await assertFailedCommand(
        `apply`,
        ctx.patchesDir,
        "Missing required configuration: repo-url",
      );
    });

    it("should fail when repo_dir is missing", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
      });

      await assertFailedCommand(
        `apply`,
        ctx.patchesDir,
        "Missing required configuration: repo-dir",
      );
    });

    it("should fail when both repo_url and repo_dir are missing", async () => {
      await setupConfigFile({
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
      });

      await assertFailedCommand(
        `apply`,
        ctx.patchesDir,
        "Missing required configuration: repo-url, repo-dir",
      );
    });

    it("should fail when explicitly specified config file doesn't exist", async () => {
      await assertFailedCommand(
        `apply --config non-existent.yaml`,
        ctx.patchesDir,
        "Configuration file not found",
      );
    });

    it("should fail with missing fields when default config doesn't exist", async () => {
      // Remove any existing patchy.yaml file
      const defaultConfigPath = join(ctx.patchesDir, "patchy.yaml");
      if (existsSync(defaultConfigPath)) {
        await rm(defaultConfigPath);
      }

      await assertFailedCommand(
        `apply`,
        ctx.patchesDir,
        "Missing required configuration: repo-url, repo-dir",
      );
    });
  });

  describe("default values", () => {
    it("should use default patches_dir when not specified", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
      });

      const result = await assertSuccessfulCommand(
        `apply --dry-run --verbose`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/example/test-repo.git
          repo_dir: main
          repo_base_dir: <TEST_DIR>/repos
          patches_dir: ./patches/
          ref: main
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from ./patches/ to main"
      `);
    });

    it("should use default ref when not specified", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
      });

      const result = await assertSuccessfulCommand(
        `apply --dry-run --verbose`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/example/test-repo.git
          repo_dir: main
          repo_base_dir: <TEST_DIR>/repos
          patches_dir: patches
          ref: main
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from patches to main"
      `);
    });
  });

  describe("flag vs yaml precedence", () => {
    it("should prefer flag values over yaml config for available flags", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
        repo_base_dir: "/yaml/base",
        patches_dir: "yaml-patches",
        ref: "yaml-ref",
        verbose: false,
      });

      const result = await assertSuccessfulCommand(
        `apply --repo-dir flag-dir --repo-base-dir /flag/base --patches-dir flag-patches --verbose --dry-run`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/yaml/repo.git
          repo_dir: flag-dir
          repo_base_dir: /flag/base
          patches_dir: flag-patches
          ref: yaml-ref
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from flag-patches to flag-dir"
      `);
    });

    it("should use yaml values when flags are not provided", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
        repo_base_dir: "/yaml/base",
        patches_dir: "yaml-patches",
        ref: "yaml-ref",
        verbose: true,
      });

      const result = await assertSuccessfulCommand(
        `apply --dry-run`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/yaml/repo.git
          repo_dir: yaml-dir
          repo_base_dir: /yaml/base
          patches_dir: yaml-patches
          ref: yaml-ref
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from yaml-patches to yaml-dir"
      `);
    });

    it("should use defaults when neither flags nor yaml provide values", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      });

      const result = await assertSuccessfulCommand(
        `apply --verbose --dry-run --repo-base-dir /home/word`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/test/repo.git
          repo_dir: test-dir
          repo_base_dir: /home/word
          patches_dir: ./patches/
          ref: main
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from ./patches/ to test-dir"
      `);
    });

    it("should handle partial flag overrides", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
        repo_base_dir: "/yaml/base",
        patches_dir: "yaml-patches",
        ref: "yaml-ref",
      });

      const result = await assertSuccessfulCommand(
        `apply --repo-dir flag-override-dir --patches-dir flag-override-patches --verbose --dry-run`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/yaml/repo.git
          repo_dir: flag-override-dir
          repo_base_dir: /yaml/base
          patches_dir: flag-override-patches
          ref: yaml-ref
          verbose: true
          dry_run: true
        [DRY RUN] Would apply patches from flag-override-patches to flag-override-dir"
      `);
    });

    it("should handle verbose flag from yaml", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: true,
      });

      const result = await assertSuccessfulCommand(`apply`, ctx.patchesDir);

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/test/repo.git
          repo_dir: test-dir
          repo_base_dir: undefined
          patches_dir: ./patches/
          ref: main
          verbose: true
          dry_run: false
        applying.."
      `);
    });

    it("should override yaml verbose with flag", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: false,
      });

      const result = await assertSuccessfulCommand(
        `apply --verbose`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/test/repo.git
          repo_dir: test-dir
          repo_base_dir: undefined
          patches_dir: ./patches/
          ref: main
          verbose: true
          dry_run: false
        applying.."
      `);
    });
  });

  describe("verbose mode", () => {
    it("should show all configuration values when verbose flag is set", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
        ref: "develop",
      });

      const result = await assertSuccessfulCommand(
        `apply --verbose`,
        ctx.patchesDir,
      );

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/example/test-repo.git
          repo_dir: main
          repo_base_dir: <TEST_DIR>/repos
          patches_dir: patches
          ref: develop
          verbose: true
          dry_run: false
        applying.."
      `);
    });

    it("should respect verbose setting from config file", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
        verbose: true,
      });

      const result = await assertSuccessfulCommand(`apply`, ctx.patchesDir);

      expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
        "Configuration resolved:
          repo_url: https://github.com/example/test-repo.git
          repo_dir: main
          repo_base_dir: <TEST_DIR>/repos
          patches_dir: patches
          ref: main
          verbose: true
          dry_run: false
        applying.."
      `);
    });
  });

  describe("custom config path", () => {
    it("should use custom config file path", async () => {
      const customConfigPath = join(ctx.patchesDir, "custom-config.yaml");
      await writeTestConfig(customConfigPath, {
        repo_url: "https://github.com/custom/repo.git",
        repo_dir: "custom-dir",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "custom-patches",
      });

      const result = await assertSuccessfulCommand(
        `apply --config custom-config.yaml --dry-run`,
        ctx.patchesDir,
      );

      expect(result.stdout).toMatchInlineSnapshot(
        `"[DRY RUN] Would apply patches from custom-patches to custom-dir"`,
      );
    });
  });
});
