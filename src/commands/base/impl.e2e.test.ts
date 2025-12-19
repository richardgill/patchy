import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cancel, runCli, runCliWithPrompts } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeJsonConfig,
} from "~/testing/fs-test-utils";

describe("patchy base", () => {
  describe("direct mode (with argument)", () => {
    it("should update base_revision when argument is provided", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "main",
        },
      });

      const result = await runCli(`patchy base v1.2.3`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Updated base_revision to: v1.2.3");

      const configPath = join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe("v1.2.3");
    });

    it("should update base_revision with SHA", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const sha = "abc123def456789";
      const result = await runCli(`patchy base ${sha}`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toContain(`Updated base_revision to: ${sha}`);

      const configPath = join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe(sha);
    });

    it("should show verbose output with --verbose flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const result = await runCli(`patchy base v2.0.0 --verbose`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Current base_revision: v1.0.0");
      expect(result.stdout).toContain("New base_revision: v2.0.0");
      expect(result.stdout).toContain("Updated base_revision to: v2.0.0");
    });

    it("should work with custom config path", async () => {
      const tmpDir = generateTmpDir();
      await writeJsonConfig(tmpDir, "custom.json", {
        source_repo: "https://github.com/example/repo",
        base_revision: "main",
      });

      const result = await runCli(
        `patchy base v1.5.0 --config custom.json`,
        tmpDir,
      );

      expect(result).toSucceed();

      const configPath = join(tmpDir, "custom.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe("v1.5.0");
    });

    it("should preserve other config fields", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
          upstream_branch: "main",
          clones_dir: "./clones",
          patches_dir: "./patches",
        },
      });

      const result = await runCli(`patchy base v2.0.0`, tmpDir);
      expect(result).toSucceed();

      const configPath = join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe("v2.0.0");
      expect(config.upstream_branch).toBe("main");
      expect(config.clones_dir).toBe("./clones");
      expect(config.patches_dir).toBe("./patches");
      expect(config.source_repo).toBe("https://github.com/example/repo");
    });
  });

  describe("interactive mode (without argument)", () => {
    it("should show current base_revision when not interactive", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
          upstream_branch: "main",
        },
      });

      const result = await runCli(`patchy base`, tmpDir);

      expect(result).toSucceed();
      expect(result.stdout).toContain("Current base_revision: v1.0.0");
      expect(result.stdout).toContain("Interactive mode requires a TTY");
    });

    it("should error when upstream_branch is not configured", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/example/repo",
          base_revision: "v1.0.0",
        },
      });

      const { result } = await runCliWithPrompts(`patchy base`, tmpDir).run();

      expect(result).toFail();
      expect(result.stderr).toContain("upstream_branch is required");
      expect(result.stderr).toContain("interactive mode");
    });

    it("should error when source_repo is not configured", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          base_revision: "v1.0.0",
          upstream_branch: "main",
        },
      });

      const { result } = await runCliWithPrompts(`patchy base`, tmpDir).run();

      expect(result).toFail();
      expect(result.stderr).toContain("source_repo is required");
    });

    it("should allow cancelling the operation", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/facebook/react",
          base_revision: "v18.0.0",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await runCliWithPrompts(`patchy base`, tmpDir)
        .on({ select: /Select new base/, respond: cancel })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toHaveLength(1);
    });

    it("should allow cancelling during manual SHA entry", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        jsonConfig: {
          source_repo: "https://github.com/facebook/react",
          base_revision: "v18.0.0",
          upstream_branch: "main",
        },
      });

      const { result, prompts } = await runCliWithPrompts(`patchy base`, tmpDir)
        .on({ select: /Select new base/, respond: "_manual" })
        .on({ text: /Enter commit SHA/, respond: cancel })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toHaveLength(2);
    });
  });

  describe("error cases", () => {
    it("should fail when config file does not exist", async () => {
      const tmpDir = generateTmpDir();

      const result = await runCli(`patchy base v1.0.0`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toContain("Configuration file not found");
    });

    it("should fail when config file is invalid JSON", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
      });

      const configPath = join(tmpDir, "patchy.json");
      const fs = await import("node:fs/promises");
      await fs.writeFile(configPath, "{ invalid json", "utf8");

      const result = await runCli(`patchy base v1.0.0`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toContain("JSON parse error");
    });

    it("should fail when config does not match schema", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
      });

      const configPath = join(tmpDir, "patchy.json");
      const fs = await import("node:fs/promises");
      await fs.writeFile(
        configPath,
        JSON.stringify({ invalid_field: 123 }),
        "utf8",
      );

      const result = await runCli(`patchy base v1.0.0`, tmpDir);

      expect(result).toFail();
      expect(result.stderr).toContain("Invalid configuration");
    });
  });
});
