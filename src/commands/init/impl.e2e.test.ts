import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptDefault,
  cancel,
  generateTmpDir,
  runCli,
  runCliWithPrompts,
  setupTestWithConfig,
} from "~/testing/test-utils";
import { getSchemaUrl } from "~/version";

describe("patchy init", () => {
  it("should initialize patchy with all flags", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "clones" },
    });

    const result = await runCli(
      `patchy init --repo-url https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
      tmpDir,
    );

    expect(result).toSucceed();
    const configPath = join(tmpDir, "patchy.json");
    expect(configPath).toExist();
    const jsonContent = readFileSync(configPath, "utf-8").trim();

    const config = JSON.parse(jsonContent);
    expect(config).toEqual({
      $schema: await getSchemaUrl(),
      repo_url: "https://github.com/example/test-repo.git",
      ref: "main",
      clones_dir: "clones",
      patches_dir: "patches",
    });
  });

  it("should not include repo_dir in config", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "clones" },
    });

    const result = await runCli(
      `patchy init --repo-url https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --ref main --force`,
      tmpDir,
    );

    expect(result).toSucceed();
    const configPath = join(tmpDir, "patchy.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).not.toHaveProperty("repo_dir");
  });

  describe("gitignore", () => {
    it("should add to .gitignore with --gitignore flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(gitignorePath).toExist();
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("clones/");
    });

    it("should not modify .gitignore with --no-gitignore flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --no-gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore without flag in non-interactive mode", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore when path is outside cwd with --gitignore flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir /tmp/some-other-clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore when path is outside cwd with relative path", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir ../outside-clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url github.com/example/repo --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url https://invalid_domain/repo --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url https://github.com/ --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toContain("valid Git URL");
    });

    it("should fail when config file exists without force flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
        jsonConfig: { hello: "world" },
      });

      await runCli(
        `patchy init --repo-url https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      const result = await runCli(
        `patchy init --repo-url https://github.com/example/another-repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `
        "Configuration file already exists at <TEST_DIR>/patchy.json
        Use --force to overwrite"
      `,
      );
    });

    it("should fail with validation error for empty repo_url", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --repo-url "" --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)"`,
      );
    });
  });

  describe("interactive prompts", () => {
    it("should complete init with interactive prompts", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
        jsonConfig: {},
      });

      const { result, prompts } = await runCliWithPrompts(
        "patchy init --force",
        tmpDir,
      )
        .on({ text: /patch files/, respond: acceptDefault })
        .on({ text: /cloned repos/, respond: acceptDefault })
        .on({ confirm: /gitignore/, respond: true })
        .on({
          text: /repository URL/,
          respond: "https://github.com/example/repo.git",
        })
        .on({ text: /ref/, respond: acceptDefault })
        .run();

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "text",
          message: expect.stringMatching(/patch files/),
          response: "default",
        },
        {
          type: "text",
          message: expect.stringMatching(/cloned repos/),
          response: "default",
        },
        {
          type: "confirm",
          message: expect.stringMatching(/gitignore/),
          response: true,
        },
        {
          type: "text",
          message: expect.stringMatching(/repository URL/),
          response: "https://github.com/example/repo.git",
        },
        {
          type: "text",
          message: expect.stringMatching(/ref/),
          response: "default",
        },
      ]);

      const configPath = join(tmpDir, "patchy.json");
      expect(configPath).toExist();
    });

    it("should handle cancel during prompts", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
        jsonConfig: {},
      });

      const { result, prompts } = await runCliWithPrompts(
        "patchy init --force",
        tmpDir,
      )
        .on({ text: /patch files/, respond: cancel })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "text",
          message: expect.stringMatching(/patch files/),
          response: "cancelled",
        },
      ]);
    });

    it("should not prompt for gitignore when clonesDir is outside cwd", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: {},
        jsonConfig: {},
      });

      const { result, prompts } = await runCliWithPrompts(
        "patchy init --force",
        tmpDir,
      )
        .on({ text: /patch files/, respond: acceptDefault })
        .on({ text: /cloned repos/, respond: "/tmp/external-clones" })
        .on({
          text: /repository URL/,
          respond: "https://github.com/example/repo.git",
        })
        .on({ text: /ref/, respond: acceptDefault })
        .run();

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "text",
          message: expect.stringMatching(/patch files/),
          response: "default",
        },
        {
          type: "text",
          message: expect.stringMatching(/cloned repos/),
          response: "/tmp/external-clones",
        },
        {
          type: "text",
          message: expect.stringMatching(/repository URL/),
          response: "https://github.com/example/repo.git",
        },
        {
          type: "text",
          message: expect.stringMatching(/ref/),
          response: "default",
        },
      ]);

      const gitignorePath = join(tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });
  });
});
