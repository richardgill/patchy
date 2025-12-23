import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path, { join } from "node:path";
import { createLocalBareRepo, getRefSha } from "~/testing/git-helpers";
import { acceptDefault, cancel, scenario } from "~/testing/scenario";
import { getSchemaUrl } from "~/version";

describe("patchy init", () => {
  it("should initialize patchy with all flags", async () => {
    const ctx = await scenario({ noConfig: true });
    mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

    const { result } = await ctx.runCli(
      `patchy init --source-repo https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --base-revision main --upstream-branch main --config patchy.json --force`,
    );

    expect(result).toSucceed();
    const configPath = join(ctx.tmpDir, "patchy.json");
    expect(configPath).toExist();
    const jsonContent = readFileSync(configPath, "utf-8").trim();

    const config = JSON.parse(jsonContent);
    expect(config).toEqual({
      $schema: await getSchemaUrl(),
      source_repo: "https://github.com/example/test-repo.git",
      base_revision: "main",
      upstream_branch: "main",
      clones_dir: "clones",
      patches_dir: "patches",
    });
  });

  it("should not include target_repo in config", async () => {
    const ctx = await scenario({ noConfig: true });
    mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

    const { result } = await ctx.runCli(
      `patchy init --source-repo https://github.com/example/test-repo.git --clones-dir clones --patches-dir patches --base-revision main --force`,
    );

    expect(result).toSucceed();
    const configPath = join(ctx.tmpDir, "patchy.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).not.toHaveProperty("target_repo");
  });

  describe("gitignore", () => {
    it("should add to .gitignore with --gitignore flag", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(gitignorePath).toExist();
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("clones/");
    });

    it("should strip ./ prefix from .gitignore entry", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ./clones --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(gitignorePath).toExist();
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
      expect(content).not.toContain("./");
    });

    it("should strip multiple ./ prefixes from .gitignore entry", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ././clones --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
      expect(content).not.toContain("./");
    });

    it("should handle ./ prefix with existing trailing slash", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ./clones/ --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe("clones/\n");
    });

    it("should not modify .gitignore with --no-gitignore flag", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --base-revision main --no-gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore without flag in non-interactive mode", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --base-revision main --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore when path is outside cwd with --gitignore flag", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir /tmp/some-other-clones --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not modify .gitignore when path is outside cwd with relative path", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir ../outside-clones --patches-dir patches --base-revision main --gitignore --force`,
      );

      expect(result).toSucceed();
      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });
  });

  describe("error cases", () => {
    it("should fail with malformed repo url - missing protocol", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo github.com/example/repo --clones-dir clones --patches-dir patches --base-revision main --config patchy.json --force`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
      );
    });

    it("should fail with malformed repo url - invalid domain", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://invalid_domain/repo --clones-dir clones --patches-dir patches --base-revision main --config patchy.json --force`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
      );
    });

    it("should fail with malformed repo url - incomplete path", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/ --clones-dir clones --patches-dir patches --base-revision main --config patchy.json --force`,
      );

      expect(result).toFail();
      expect(result.stderr).toContain("valid Git URL");
    });

    it("should fail when config file exists without force flag", async () => {
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      await ctx.runCli(
        `patchy init --source-repo https://github.com/example/repo.git --clones-dir clones --patches-dir patches --base-revision main --config patchy.json --force`,
      );

      const { result } = await ctx.runCli(
        `patchy init --source-repo https://github.com/example/another-repo.git --clones-dir clones --patches-dir patches --base-revision main --config patchy.json`,
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
      const ctx = await scenario({ noConfig: true });
      mkdirSync(join(ctx.tmpDir, "clones"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy init --source-repo "" --clones-dir clones --patches-dir patches --base-revision main --config patchy.json --force`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)"`,
      );
    });
  });

  describe("interactive prompts", () => {
    it("should complete init with interactive prompts", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          {
            text: /repository URL/,
            respond: "https://github.com/example/repo.git",
          },
          { text: /[Bb]ase revision/, respond: acceptDefault },
          { confirm: /Clone repo/, respond: false },
        )
        .runCli("patchy init --force");

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
          message: expect.stringMatching(/[Bb]ase revision/),
          response: "default",
        },
        {
          type: "confirm",
          message: expect.stringMatching(/Clone repo/),
          response: false,
        },
      ]);

      const configPath = join(ctx.tmpDir, "patchy.json");
      expect(configPath).toExist();
    });

    it("should handle cancel during prompts", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts({ text: /patch files/, respond: cancel })
        .runCli("patchy init --force");

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
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: "/tmp/external-clones" },
          {
            text: /repository URL/,
            respond: "https://github.com/example/repo.git",
          },
          { text: /[Bb]ase revision/, respond: acceptDefault },
        )
        .runCli("patchy init --force");

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
          message: expect.stringMatching(/[Bb]ase revision/),
          response: "default",
        },
      ]);

      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should not prompt for gitignore when clonesDir uses tilde path", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: "~/code/test-clones" },
          {
            text: /repository URL/,
            respond: "https://github.com/example/repo.git",
          },
          { text: /[Bb]ase revision/, respond: acceptDefault },
        )
        .runCli("patchy init --force");

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
          response: "~/code/test-clones",
        },
        {
          type: "text",
          message: expect.stringMatching(/repository URL/),
          response: "https://github.com/example/repo.git",
        },
        {
          type: "text",
          message: expect.stringMatching(/[Bb]ase revision/),
          response: "default",
        },
      ]);

      const gitignorePath = join(ctx.tmpDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);
    });

    it("should prompt to clone and run clone when user accepts", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir });
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          { text: /repository URL/, respond: bareRepoUrl },
          { select: /upstream branch/, respond: "_none" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "main" },
          { confirm: /Clone bare-repo/, respond: true },
          { confirm: /Save target_repo/, respond: true },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).toHaveOutput("patchy generate");

      expect(prompts).toMatchObject([
        { type: "text", message: expect.stringMatching(/patch files/) },
        { type: "text", message: expect.stringMatching(/cloned repos/) },
        { type: "confirm", message: expect.stringMatching(/gitignore/) },
        { type: "text", message: expect.stringMatching(/repository URL/) },
        { type: "select", message: expect.stringMatching(/upstream branch/) },
        { type: "select", message: expect.stringMatching(/base revision/) },
        { type: "text", message: expect.stringMatching(/commit SHA or tag/) },
        { type: "confirm", message: expect.stringMatching(/Clone bare-repo/) },
        { type: "confirm", message: expect.stringMatching(/Save target_repo/) },
      ]);

      const clonedDir = path.join(ctx.tmpDir, "clones", "bare-repo");
      expect(existsSync(clonedDir)).toBe(true);
    });

    it("should show manual clone instructions when user declines clone prompt", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          {
            text: /repository URL/,
            respond: "https://github.com/example/repo.git",
          },
          { text: /[Bb]ase revision/, respond: acceptDefault },
          { confirm: /Clone repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();
      expect(result).toHaveOutput("patchy repo clone");
      expect(result).toHaveOutput("when you're ready");
      expect(result).not.toHaveOutput("Successfully cloned");

      expect(prompts).toMatchObject([
        { type: "text", message: expect.stringMatching(/patch files/) },
        { type: "text", message: expect.stringMatching(/cloned repos/) },
        { type: "confirm", message: expect.stringMatching(/gitignore/) },
        { type: "text", message: expect.stringMatching(/repository URL/) },
        { type: "text", message: expect.stringMatching(/[Bb]ase revision/) },
        {
          type: "confirm",
          message: expect.stringMatching(/Clone repo/),
          response: false,
        },
      ]);
    });

    it("should allow selecting None for upstream branch", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir });
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          { text: /repository URL/, respond: bareRepoUrl },
          { select: /upstream branch/, respond: "_none" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "abc123" },
          { confirm: /Clone bare-repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const configPath = path.join(ctx.tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config).not.toHaveProperty("upstream_branch");
      expect(config.base_revision).toBe("abc123");
    });

    it("should save selected branch as upstream_branch", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir });
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          { text: /repository URL/, respond: bareRepoUrl },
          { select: /upstream branch/, respond: "main" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "abc123" },
          { confirm: /Clone bare-repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const configPath = path.join(ctx.tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.upstream_branch).toBe("main");
      expect(config.base_revision).toBe("abc123");

      const upstreamPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("upstream"),
      );
      expect(upstreamPrompt).toBeDefined();
    });

    it("should order upstream branch options with preferred branch first, then None, then others", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({
        dir: bareRepoDir,
        branches: ["develop", "feature-x"],
      });
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          { text: /repository URL/, respond: bareRepoUrl },
          { select: /upstream branch/, respond: "main" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "abc123" },
          { confirm: /Clone bare-repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const upstreamPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("upstream"),
      );
      expect(upstreamPrompt?.type).toBe("select");
      if (upstreamPrompt?.type !== "select") return;

      const optionValues = upstreamPrompt.options.map((o) => o.value);
      expect(optionValues[0]).toBe("main");
      expect(optionValues[1]).toBe("_none");
      expect(optionValues.slice(2)).toEqual(
        expect.arrayContaining(["develop", "feature-x"]),
      );
    });

    it("should save selected tag as base_revision", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir, tags: ["v1.0.0"] });
      const tagSha = await getRefSha(bareRepoDir, "v1.0.0");
      const bareRepoUrl = `file://${bareRepoDir}`;

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          { text: /repository URL/, respond: bareRepoUrl },
          { select: /upstream branch/, respond: "_none" },
          { select: /base revision/, respond: tagSha },
          { confirm: /Clone bare-repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const configPath = path.join(ctx.tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe(tagSha);

      const baseRevisionPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("base revision"),
      );
      expect(baseRevisionPrompt).toBeDefined();
    });

    it("should fallback to text input when remote fetch fails", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: true },
          {
            text: /repository URL/,
            respond: "/nonexistent/invalid/path",
          },
          { text: /[Bb]ase revision/, respond: "main" },
          { confirm: /Clone/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const baseRevisionPrompt = prompts.find(
        (p) => p.type === "text" && p.message.toLowerCase().includes("base"),
      );
      expect(baseRevisionPrompt).toBeDefined();
      expect(baseRevisionPrompt?.type).toBe("text");

      const configPath = path.join(ctx.tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.base_revision).toBe("main");
    });

    it("should fallback to text input when relative local path does not exist", async () => {
      const ctx = await scenario({ noConfig: true });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: false },
          { text: /repository URL/, respond: "./nonexistent-upstream" },
          { text: /[Bb]ase revision/, respond: "main" },
          { confirm: /Clone/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const baseRevisionPrompt = prompts.find(
        (p) => p.type === "text" && p.message.toLowerCase().includes("base"),
      );
      expect(baseRevisionPrompt).toBeDefined();
      expect(baseRevisionPrompt?.type).toBe("text");
    });

    it("should fetch refs from local repo with relative path", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "upstream");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir, tags: ["v1.0.0"] });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: false },
          { text: /repository URL/, respond: "./upstream" },
          { select: /upstream branch/, respond: "_none" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "main" },
          { confirm: /Clone upstream/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const upstreamBranchPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("upstream branch"),
      );
      expect(upstreamBranchPrompt).toBeDefined();

      const baseRevisionPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("base revision"),
      );
      expect(baseRevisionPrompt).toBeDefined();
    });

    it("should fetch refs from local repo with absolute path", async () => {
      const ctx = await scenario({ noConfig: true });
      const bareRepoDir = path.join(ctx.tmpDir, "local-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir, tags: ["v2.0.0"] });

      const { result, prompts } = await ctx
        .withPrompts(
          { text: /patch files/, respond: acceptDefault },
          { text: /cloned repos/, respond: acceptDefault },
          { confirm: /gitignore/, respond: false },
          { text: /repository URL/, respond: bareRepoDir },
          { select: /upstream branch/, respond: "_none" },
          { select: /base revision/, respond: "_manual" },
          { text: /commit SHA or tag/, respond: "main" },
          { confirm: /Clone local-repo/, respond: false },
        )
        .runCli("patchy init --force");

      expect(result).toSucceed();

      const upstreamBranchPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("upstream branch"),
      );
      expect(upstreamBranchPrompt).toBeDefined();

      const baseRevisionPrompt = prompts.find(
        (p) => p.type === "select" && p.message.includes("base revision"),
      );
      expect(baseRevisionPrompt).toBeDefined();
    });
  });

  it("should show manual clone instructions in non-interactive mode", async () => {
    const ctx = await scenario({ noConfig: true });

    const { result } = await ctx.runCli(
      `patchy init --force --patches-dir patches --clones-dir clones --source-repo https://github.com/example/repo.git --base-revision main --gitignore`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("patchy repo clone");
    expect(result).not.toHaveOutput("patchy generate");
  });
});
