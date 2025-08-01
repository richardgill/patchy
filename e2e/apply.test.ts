import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertFailedCommand,
  assertSuccessfulCommand,
  cleanupTestDir,
  createTestDir,
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

    await assertSuccessfulCommand(
      `apply --repoDir main --repoBaseDir ${ctx.repoBaseDir} --patchesDir patches --config patchy.yaml --verbose --dryRun`,
      ctx.patchesDir,
      (result) => {
        expect(result.stdout).toContain("[DRY RUN]");
        expect(result.stdout).toContain("patches to main");
      },
    );
  });

  it("should apply patches using config file values", async () => {
    await setupConfigFile({
      repo_url: "https://github.com/example/test-repo.git",
      repo_dir: "upstream",
      repo_base_dir: ctx.repoBaseDir,
      patches_dir: "my-patches",
      ref: "main",
    });

    await assertSuccessfulCommand(
      `apply --dryRun`,
      ctx.patchesDir,
      (result) => {
        expect(result.stdout).toContain("[DRY RUN]");
        expect(result.stdout).toContain("my-patches to upstream");
      },
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

    await assertSuccessfulCommand(
      `apply --repoDir cli-repo --patchesDir cli-patches --dryRun`,
      ctx.patchesDir,
      (result) => {
        expect(result.stdout).toContain("[DRY RUN]");
        expect(result.stdout).toContain("cli-patches to cli-repo");
      },
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

      await assertFailedCommand(`apply`, ctx.patchesDir, [
        "repo-url",
        "repo-dir",
      ]);
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

      await assertFailedCommand(`apply`, ctx.patchesDir, [
        "repo-url",
        "repo-dir",
      ]);
    });
  });

  describe("default values", () => {
    it("should use default repo_base_dir when not specified", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        patches_dir: "patches",
      });

      await assertSuccessfulCommand(
        `apply --dryRun --verbose`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toMatch(/repo_base_dir: .*\/\.patchy\/repos/);
        },
      );
    });

    it("should use default patches_dir when not specified", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
      });

      await assertSuccessfulCommand(
        `apply --dryRun --verbose`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toMatch(/patches_dir: \.?\/?patches/);
        },
      );
    });

    it("should use default ref when not specified", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
      });

      await assertSuccessfulCommand(
        `apply --dryRun --verbose`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain("ref: main");
        },
      );
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

      await assertSuccessfulCommand(
        `apply --repoDir flag-dir --repoBaseDir /flag/base --patchesDir flag-patches --verbose --dryRun`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain(
            "repo_url: https://github.com/yaml/repo.git",
          );
          expect(result.stdout).toContain("repo_dir: flag-dir");
          expect(result.stdout).toContain("repo_base_dir: /flag/base");
          expect(result.stdout).toContain("patches_dir: flag-patches");
          expect(result.stdout).toContain("ref: yaml-ref");
          expect(result.stdout).toContain("verbose: true");
          expect(result.stdout).toContain("dry_run: true");
        },
      );
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

      await assertSuccessfulCommand(
        `apply --dryRun`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain(
            "repo_url: https://github.com/yaml/repo.git",
          );
          expect(result.stdout).toContain("repo_dir: yaml-dir");
          expect(result.stdout).toContain("repo_base_dir: /yaml/base");
          expect(result.stdout).toContain("patches_dir: yaml-patches");
          expect(result.stdout).toContain("ref: yaml-ref");
          expect(result.stdout).toContain("verbose: true");
          expect(result.stdout).toContain("dry_run: true");
        },
      );
    });

    it("should use defaults when neither flags nor yaml provide values", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      });

      await assertSuccessfulCommand(
        `apply --verbose --dryRun`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toMatch(/repo_base_dir: .*\/\.patchy\/repos/);
          expect(result.stdout).toMatch(/patches_dir: \.?\/?patches/);
          expect(result.stdout).toContain("ref: main");
        },
      );
    });

    it("should handle partial flag overrides", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
        repo_base_dir: "/yaml/base",
        patches_dir: "yaml-patches",
        ref: "yaml-ref",
      });

      await assertSuccessfulCommand(
        `apply --repoDir flag-override-dir --patchesDir flag-override-patches --verbose --dryRun`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain(
            "repo_url: https://github.com/yaml/repo.git",
          );
          expect(result.stdout).toContain("repo_dir: flag-override-dir");
          expect(result.stdout).toContain("repo_base_dir: /yaml/base");
          expect(result.stdout).toContain("patches_dir: flag-override-patches");
          expect(result.stdout).toContain("ref: yaml-ref");
        },
      );
    });

    it("should handle verbose flag from yaml", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: true,
      });

      await assertSuccessfulCommand(`apply`, ctx.patchesDir, (result) => {
        expect(result.stdout).toContain("Configuration resolved:");
        expect(result.stdout).toContain("verbose: true");
        expect(result.stdout).toContain("dry_run: false");
      });
    });

    it("should override yaml verbose with flag", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: false,
      });

      await assertSuccessfulCommand(
        `apply --verbose`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain("Configuration resolved:");
          expect(result.stdout).toContain("verbose: true");
        },
      );
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

      await assertSuccessfulCommand(
        `apply --verbose`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain("Configuration resolved:");
          expect(result.stdout).toContain(
            "repo_url: https://github.com/example/test-repo.git",
          );
          expect(result.stdout).toContain("repo_dir: main");
          expect(result.stdout).toContain(`repo_base_dir: ${ctx.repoBaseDir}`);
          expect(result.stdout).toMatch(/patches_dir: \.?\/?patches/);
          expect(result.stdout).toContain("ref: develop");
          expect(result.stdout).toContain("verbose: true");
          expect(result.stdout).toContain("dry_run: false");
        },
      );
    });

    it("should respect verbose setting from config file", async () => {
      await setupConfigFile({
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "main",
        repo_base_dir: ctx.repoBaseDir,
        patches_dir: "patches",
        verbose: true,
      });

      await assertSuccessfulCommand(`apply`, ctx.patchesDir, (result) => {
        expect(result.stdout).toContain("Configuration resolved:");
        expect(result.stdout).toContain(
          "repo_url: https://github.com/example/test-repo.git",
        );
        expect(result.stdout).toContain("repo_dir: main");
      });
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

      await assertSuccessfulCommand(
        `apply --config custom-config.yaml --dryRun`,
        ctx.patchesDir,
        (result) => {
          expect(result.stdout).toContain("custom-patches to custom-dir");
        },
      );
    });
  });
});
