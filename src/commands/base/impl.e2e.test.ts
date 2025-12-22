import { describe, expect, it } from "bun:test";
import { cancel, scenario } from "~/testing/scenario";

describe("patchy base", () => {
  describe("direct mode (with argument)", () => {
    it("should update base_revision when argument is provided", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo",
          base_revision: "main",
        },
      });

      const { result } = await ctx.runCli("patchy base v1.2.3");

      expect(result).toSucceed();
      expect(result.stdout).toContain("Updated base_revision to: v1.2.3");

      const config = ctx.config();
      expect(config["base_revision"]).toBe("v1.2.3");
    });

    it("should update base_revision with SHA", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const sha = "abc123def456789";
      const { result } = await ctx.runCli(`patchy base ${sha}`);

      expect(result).toSucceed();
      expect(result.stdout).toContain(`Updated base_revision to: ${sha}`);

      const config = ctx.config();
      expect(config["base_revision"]).toBe(sha);
    });

    it("should show verbose output with --verbose flag", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const { result } = await ctx.runCli("patchy base v2.0.0 --verbose");

      expect(result).toSucceed();
      expect(result.stdout).toContain("Current base_revision: v1.0.0");
      expect(result.stdout).toContain("New base_revision: v2.0.0");
      expect(result.stdout).toContain("Updated base_revision to: v2.0.0");
    });

    it("should work with custom config path", async () => {
      const ctx = await scenario({
        configPath: "custom.json",
        rawConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "main",
        },
      });

      const { result } = await ctx.runCli(
        "patchy base v1.5.0 --config custom.json",
      );

      expect(result).toSucceed();

      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const configPath = join(ctx.tmpDir, "custom.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe("v1.5.0");
    });

    it("should preserve other config fields", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
          upstream_branch: "main",
          clones_dir: "./clones",
          patches_dir: "./patches",
        },
      });

      const { result } = await ctx.runCli("patchy base v2.0.0");
      expect(result).toSucceed();

      const config = ctx.config();
      expect(config["base_revision"]).toBe("v2.0.0");
      expect(config["upstream_branch"]).toBe("main");
      expect(config["clones_dir"]).toBe("./clones");
      expect(config["patches_dir"]).toBe("./patches");
      expect(config["source_repo"]).toBe("https://github.com/example/repo");
    });
  });

  describe("interactive mode (without argument)", () => {
    it("should show current base_revision when not interactive", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
          upstream_branch: "main",
        },
      });

      const { result } = await ctx.runCli("patchy base");

      expect(result).toSucceed();
      expect(result.stdout).toContain("Current base_revision: v1.0.0");
      expect(result.stdout).toContain("Interactive mode requires a TTY");
    });

    it("should error when upstream_branch is not configured", async () => {
      const { runCli } = await scenario({
        tty: true,
        rawConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const { result } = await runCli("patchy base");

      expect(result).toFail();
      expect(result.stderr).toContain("upstream_branch is required");
      expect(result.stderr).toContain("interactive mode");
    });

    it("should error when source_repo is not configured", async () => {
      const { runCli } = await scenario({
        tty: true,
        rawConfig: {
          base_revision: "v1.0.0",
          upstream_branch: "main",
        },
      });

      const { result } = await runCli("patchy base");

      expect(result).toFail();
      expect(result.stderr).toContain("source_repo is required");
    });

    it("should allow cancelling the operation", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/facebook/react",
          base_revision: "v18.0.0",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await ctx
        .withPrompts({ select: /Select new base/, respond: cancel })
        .runCli("patchy base");

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toHaveLength(1);
    });

    it("should allow cancelling during manual SHA entry", async () => {
      const ctx = await scenario({
        config: {
          source_repo: "https://github.com/facebook/react",
          base_revision: "v18.0.0",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await ctx
        .withPrompts(
          { select: /Select new base/, respond: "_manual" },
          { text: /Enter commit SHA/, respond: cancel },
        )
        .runCli("patchy base");

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toHaveLength(2);
    });

    it("should update config when selecting a tag from remote", async () => {
      const ctx = await scenario({
        bareRepo: {
          tags: ["v1.2.3"],
        },
        config: {
          base_revision: "old-revision",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await ctx
        .withPrompts({
          select: /Select new base/,
          respond: "v1.2.3",
        })
        .runCli("patchy base");

      expect(result).toSucceed();

      const config = ctx.config();
      expect(typeof config["base_revision"]).toBe("string");
      expect(config["base_revision"]).not.toBe("old-revision");

      expect(prompts).toMatchObject([
        { type: "select", message: expect.stringMatching(/Select new base/) },
      ]);
    });

    it("should update config when selecting a branch from remote", async () => {
      const ctx = await scenario({
        bareRepo: {
          branches: ["develop"],
        },
        config: {
          base_revision: "old-revision",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await ctx
        .withPrompts({
          select: /Select new base/,
          respond: "develop",
        })
        .runCli("patchy base");

      expect(result).toSucceed();

      const config = ctx.config();
      expect(typeof config["base_revision"]).toBe("string");
      expect(config["base_revision"]).not.toBe("old-revision");

      expect(prompts).toMatchObject([
        { type: "select", message: expect.stringMatching(/Select new base/) },
      ]);
    });

    it("should update config when entering manual SHA", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: {
          base_revision: "old-revision",
          upstream_branch: "main",
        },
      });

      const manualSha = "abc123def456";

      const { result, prompts } = await ctx
        .withPrompts(
          { select: /Select new base/, respond: "_manual" },
          { text: /Enter commit SHA/, respond: manualSha },
        )
        .runCli("patchy base");

      expect(result).toSucceed();

      const config = ctx.config();
      expect(config["base_revision"]).toBe(manualSha);

      expect(prompts).toMatchObject([
        { type: "select", message: expect.stringMatching(/Select new base/) },
        { type: "text", message: expect.stringMatching(/Enter commit SHA/) },
      ]);
    });
  });

  describe("error cases", () => {
    it("should fail when config file does not exist", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result } = await ctx.runCli("patchy base v1.0.0");

      expect(result).toFail();
      expect(result.stderr).toContain("Configuration file not found");
    });

    it("should fail when config file is invalid JSON", async () => {
      const ctx = await scenario({
        configContent: "{ invalid json",
      });

      const { result } = await ctx.runCli("patchy base v1.0.0");

      expect(result).toFail();
      expect(result.stderr).toContain("JSON parse error");
    });

    it("should fail when config does not match schema", async () => {
      const ctx = await scenario({
        rawConfig: { invalid_field: 123 },
      });

      const { result } = await ctx.runCli("patchy base v1.0.0");

      expect(result).toFail();
      expect(result.stderr).toContain("Invalid configuration");
    });
  });
});
