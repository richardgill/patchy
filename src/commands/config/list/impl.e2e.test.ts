import { describe, expect, it } from "bun:test";
import { scenario } from "~/testing/scenario";

describe("patchy config list", () => {
  describe("basic output", () => {
    it("should list all set values with aligned output", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo.git",
          target_repo: "my-repo",
          clones_dir: "repos",
          patches_dir: "patches",
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      expect(result.stdout).toContain("source_repo");
      expect(result.stdout).toContain("https://github.com/example/repo.git");
      expect(result.stdout).toContain("target_repo");
      expect(result.stdout).toContain("my-repo");
      expect(result.stdout).toContain("clones_dir");
      expect(result.stdout).toContain("repos");
      expect(result.stdout).toContain("patches_dir");
      expect(result.stdout).toContain("patches");
    });

    it("should have consistent key alignment with 2 spaces between key and value", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo.git",
          verbose: true,
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      const lines = result.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        expect(line).toMatch(/^\w+\s{2,}\S/);
      }
    });
  });

  describe("omit undefined values", () => {
    it("should not show patch_set if not set", async () => {
      const ctx = await scenario({
        rawConfig: {
          source_repo: "https://github.com/example/repo.git",
          clones_dir: "repos",
          patches_dir: "patches",
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      expect(result.stdout).not.toMatch(/^patch_set\s/m);
      expect(result.stdout).not.toContain("patch_set_path");
    });
  });

  describe("computed paths", () => {
    it("should show computed paths as absolute", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "repos",
          target_repo: "my-repo",
          patches_dir: "patches",
          patch_set: "feature-set",
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      expect(result.stdout).toContain("<TEST_DIR>/repos");
      expect(result.stdout).toContain("<TEST_DIR>/repos/my-repo");
      expect(result.stdout).toContain("<TEST_DIR>/patches");
      expect(result.stdout).toContain("<TEST_DIR>/patches/feature-set");
    });
  });

  describe("boolean values", () => {
    it('should output verbose: true as "true"', async () => {
      const ctx = await scenario({
        config: {
          verbose: true,
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      expect(result.stdout).toMatch(/verbose\s+true/);
    });

    it('should output verbose: false as "false"', async () => {
      const ctx = await scenario({
        config: {
          verbose: false,
        },
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toSucceed();
      expect(result.stdout).toMatch(/verbose\s+false/);
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
        "patchy config list --config custom-config.json",
      );

      expect(result).toSucceed();
      expect(result.stdout).toContain("custom-repo");
    });
  });

  describe("error cases", () => {
    it("should exit 1 when config file does not exist", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result } = await ctx.runCli(
        "patchy config list --config missing.json",
      );

      expect(result).toFail();
      expect(result.stderr).toContain("Configuration file not found");
    });

    it("should exit 1 when config file is invalid JSON", async () => {
      const ctx = await scenario({
        configContent: "{ invalid json",
      });

      const { result } = await ctx.runCli("patchy config list");

      expect(result).toFail();
      expect(result.stderr).toContain("JSON parse error");
    });
  });
});
