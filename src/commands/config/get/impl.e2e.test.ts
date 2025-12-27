import { describe, expect, it } from "bun:test";
import { scenario } from "~/testing/scenario";

describe("patchy config get", () => {
  describe("raw keys", () => {
    it("should output raw string value for target_repo", async () => {
      const ctx = await scenario({
        config: {
          target_repo: "my-repo",
        },
      });

      const { result } = await ctx.runCli("patchy config get target_repo");

      expect(result).toSucceed();
      expect(result.stdout).toBe("my-repo");
    });

    it("should output raw string value for source_repo", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo.git",
        },
      });

      const { result } = await ctx.runCli("patchy config get source_repo");

      expect(result).toSucceed();
      expect(result.stdout).toBe("https://github.com/example/repo.git");
    });

    it("should output raw string value for clones_dir", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "./my-clones",
        },
      });

      const { result } = await ctx.runCli("patchy config get clones_dir");

      expect(result).toSucceed();
      expect(result.stdout).toBe("./my-clones");
    });

    it("should output raw string value for patch_set", async () => {
      const ctx = await scenario({
        config: {
          patch_set: "feature-branch",
        },
      });

      const { result } = await ctx.runCli("patchy config get patch_set");

      expect(result).toSucceed();
      expect(result.stdout).toBe("feature-branch");
    });
  });

  describe("computed keys", () => {
    it("should output absolute path for target_repo_path", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const { result } = await ctx.runCli("patchy config get target_repo_path");

      expect(result).toSucceed();
      expect(result.stdout).toBe("<TEST_DIR>/repos/my-repo");
    });

    it("should output absolute path for clones_dir_path", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "repos",
        },
      });

      const { result } = await ctx.runCli("patchy config get clones_dir_path");

      expect(result).toSucceed();
      expect(result.stdout).toBe("<TEST_DIR>/repos");
    });

    it("should output absolute path for patches_dir_path", async () => {
      const ctx = await scenario({
        config: {
          patches_dir: "my-patches",
        },
      });

      const { result } = await ctx.runCli("patchy config get patches_dir_path");

      expect(result).toSucceed();
      expect(result.stdout).toBe("<TEST_DIR>/my-patches");
    });

    it("should output absolute path for patch_set_path", async () => {
      const ctx = await scenario({
        config: {
          patches_dir: "patches",
          patch_set: "feature-set",
        },
      });

      const { result } = await ctx.runCli("patchy config get patch_set_path");

      expect(result).toSucceed();
      expect(result.stdout).toBe("<TEST_DIR>/patches/feature-set");
    });
  });

  describe("boolean keys", () => {
    it('should output "true" for verbose: true', async () => {
      const ctx = await scenario({
        config: {
          verbose: true,
        },
      });

      const { result } = await ctx.runCli("patchy config get verbose");

      expect(result).toSucceed();
      expect(result.stdout).toBe("true");
    });

    it('should output "false" for verbose: false', async () => {
      const ctx = await scenario({
        config: {
          verbose: false,
        },
      });

      const { result } = await ctx.runCli("patchy config get verbose");

      expect(result).toSucceed();
      expect(result.stdout).toBe("false");
    });
  });

  describe("error cases", () => {
    it("should exit 1 for unknown key", async () => {
      const ctx = await scenario({
        config: {},
      });

      const { result } = await ctx.runCli("patchy config get nonexistent_key");

      expect(result).toFail();
      expect(result.stderr).toContain("Unknown config key: nonexistent_key");
      expect(result.stderr).toContain("Valid keys:");
    });

    it("should exit 1 for unset raw key", async () => {
      const ctx = await scenario({
        rawConfig: {
          source_repo: "https://github.com/example/repo.git",
        },
      });

      const { result } = await ctx.runCli("patchy config get patch_set");

      expect(result).toFail();
      expect(result.stderr).toContain("Key not set: patch_set");
    });

    it("should output empty string and exit 0 for computed key when underlying field is missing", async () => {
      const ctx = await scenario({
        rawConfig: {
          source_repo: "https://github.com/example/repo.git",
          clones_dir: "./clones",
          patches_dir: "./patches",
        },
      });

      const { result } = await ctx.runCli("patchy config get patch_set_path");

      expect(result).toSucceed();
      expect(result.stdout).toBe("");
    });

    it("should exit 1 when config file does not exist", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result } = await ctx.runCli(
        "patchy config get target_repo --config missing.json",
      );

      expect(result).toFail();
      expect(result.stderr).toContain("Configuration file not found");
    });

    it("should exit 1 when config file is invalid JSON", async () => {
      const ctx = await scenario({
        configContent: "{ invalid json",
      });

      const { result } = await ctx.runCli("patchy config get target_repo");

      expect(result).toFail();
      expect(result.stderr).toContain("JSON parse error");
    });
  });

  describe("custom config path", () => {
    it("should read from custom config path", async () => {
      const ctx = await scenario({
        configPath: "custom-config.json",
        rawConfig: {
          source_repo: "https://github.com/custom/repo.git",
          target_repo: "custom-repo",
        },
      });

      const { result } = await ctx.runCli(
        "patchy config get target_repo --config custom-config.json",
      );

      expect(result).toSucceed();
      expect(result.stdout).toBe("custom-repo");
    });
  });

  describe("env var override", () => {
    it("should use env var override for target_repo", async () => {
      const ctx = await scenario({
        config: {
          target_repo: "config-repo",
        },
        env: {
          PATCHY_TARGET_REPO: "env-repo",
        },
      });

      const { result } = await ctx.runCli("patchy config get target_repo");

      expect(result).toSucceed();
      expect(result.stdout).toBe("env-repo");
    });
  });
});
