import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path, { join } from "node:path";
import {
  acceptDefault,
  cancel,
  runCli,
  runCliWithPrompts,
} from "~/testing/e2e-utils";
import { generateTmpDir, setupTestWithConfig } from "~/testing/fs-test-utils";
import { initBareRepoWithCommit } from "~/testing/git-helpers";
import { getSchemaUrl } from "~/version";

describe("patchy init", () => {
  it("should initialize patchy with all flags", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "clones" },
    });

    const result = await runCli(
      `patchy init --source-repo https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
      tmpDir,
    );

    expect(result).toSucceed();
    const configPath = join(tmpDir, "patchy.json");
    expect(configPath).toExist();
    const jsonContent = readFileSync(configPath, "utf-8").trim();

    const config = JSON.parse(jsonContent);
    expect(config).toEqual({
      $schema: await getSchemaUrl(),
      source_repo: "https://github.com/example/test-repo.git",
      ref: "main",
      clones_dir: "clones",
      patches_dir: "patches",
    });
  });

  it("should not include target_repo in config", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "clones" },
    });

    const result = await runCli(
      `patchy init --source-repo https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --ref main --force`,
      tmpDir,
    );

    expect(result).toSucceed();
    const configPath = join(tmpDir, "patchy.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).not.toHaveProperty("target_repo");
  });

  describe("gitignore", () => {
    it("should add to .gitignore with --gitignore flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(gitignorePath).toExist();
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("clones/");
    });

    it("should strip ./ prefix from .gitignore entry", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ./clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      expect(gitignorePath).toExist();
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
      expect(content).not.toContain("./");
    });

    it("should strip multiple ./ prefixes from .gitignore entry", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ././clones --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
      expect(content).not.toContain("./");
    });

    it("should handle ./ prefix with existing trailing slash", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ./clones/ --patches-dir patches --ref main --gitignore --force`,
        tmpDir,
      );

      expect(result).toSucceed();
      const gitignorePath = join(tmpDir, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
    });

    it("should not modify .gitignore with --no-gitignore flag", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --no-gitignore --force`,
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
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --force`,
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
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir /tmp/some-other-clones --patches-dir patches --ref main --gitignore --force`,
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
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ../outside-clones --patches-dir patches --ref main --gitignore --force`,
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
        `patchy init --source-repo github.com/example/repo --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
      );
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://invalid_domain/repo --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
      );
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo https://github.com/ --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
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
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      const result = await runCli(
        `patchy init --source-repo https://github.com/example/another-repo.git --clones-dir clones --patches-dir patches --ref main --config patchy.json`,
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

    it("should fail with validation error for empty source_repo", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "clones" },
      });

      const result = await runCli(
        `patchy init --source-repo "" --clones-dir clones --patches-dir patches --ref main --config patchy.json --force`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
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
        .on({ confirm: /Clone repo/, respond: false })
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
        {
          type: "confirm",
          message: expect.stringMatching(/Clone repo/),
          response: false,
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

    it("should not prompt for gitignore when clonesDir uses tilde path", async () => {
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
        .on({ text: /cloned repos/, respond: "~/code/test-clones" })
        .on({
          text: /repository URL/,
          respond: "https://github.com/example/repo.git",
        })
        .on({ text: /ref/, respond: acceptDefault })
        .run();

      expect(result).toSucceed();
      // Should NOT have a gitignore prompt since ~/code/test-clones is outside the project
      expect(prompts).toMatchObject([
        {
          type: "text",
          message: expect.stringMatching(/patch files/),
          response: "default",
        },
        {
          type: "text",
          message: expect.stringMatching(/cloned repos/),
          response: "~/code/test-clones",
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

    it("should prompt to clone and run clone when user accepts", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result, prompts } = await runCliWithPrompts(
        "patchy init --force",
        tmpDir,
      )
        .on({ text: /patch files/, respond: acceptDefault })
        .on({ text: /cloned repos/, respond: acceptDefault })
        .on({ confirm: /gitignore/, respond: true })
        .on({ text: /repository URL/, respond: bareRepoUrl })
        .on({ text: /ref/, respond: acceptDefault })
        .on({ confirm: /Clone bare-repo/, respond: true })
        .on({ confirm: /Save target_repo/, respond: true })
        .run();

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).toHaveOutput("patchy generate");

      expect(prompts).toMatchObject([
        { type: "text", message: expect.stringMatching(/patch files/) },
        { type: "text", message: expect.stringMatching(/cloned repos/) },
        { type: "confirm", message: expect.stringMatching(/gitignore/) },
        { type: "text", message: expect.stringMatching(/repository URL/) },
        { type: "text", message: expect.stringMatching(/ref/) },
        { type: "confirm", message: expect.stringMatching(/Clone bare-repo/) },
        { type: "confirm", message: expect.stringMatching(/Save target_repo/) },
      ]);

      // Verify clone actually happened
      const clonedDir = path.join(tmpDir, "clones", "bare-repo");
      expect(existsSync(clonedDir)).toBe(true);
    });

    it("should show manual clone instructions when user declines clone prompt", async () => {
      const tmpDir = generateTmpDir();

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
        .on({ confirm: /Clone repo/, respond: false })
        .run();

      expect(result).toSucceed();
      expect(result).toHaveOutput("patchy repo clone");
      expect(result).toHaveOutput("when you're ready");
      expect(result).not.toHaveOutput("Successfully cloned");

      expect(prompts).toMatchObject([
        { type: "text", message: expect.stringMatching(/patch files/) },
        { type: "text", message: expect.stringMatching(/cloned repos/) },
        { type: "confirm", message: expect.stringMatching(/gitignore/) },
        { type: "text", message: expect.stringMatching(/repository URL/) },
        { type: "text", message: expect.stringMatching(/ref/) },
        {
          type: "confirm",
          message: expect.stringMatching(/Clone repo/),
          response: false,
        },
      ]);
    });
  });

  it("should show manual clone instructions in non-interactive mode", async () => {
    const tmpDir = generateTmpDir();

    const result = await runCli(
      `patchy init --force --patches-dir patches --clones-dir clones --source-repo https://github.com/example/repo.git --ref main --gitignore`,
      tmpDir,
    );

    expect(result).toSucceed();
    // In non-interactive mode, clone prompt is skipped and manual instructions are shown
    expect(result).toHaveOutput("patchy repo clone");
    // Should NOT contain the next-steps message since clone wasn't run
    expect(result).not.toHaveOutput("patchy generate");
  });
});
