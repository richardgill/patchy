import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createTestGitClient } from "~/lib/git";
import { runCli } from "~/testing/e2e-utils";
import { generateTmpDir, setupTestWithConfig } from "~/testing/fs-test-utils";
import {
  createLocalBareRepo,
  createLocalRepo,
  getCurrentBranch,
  getCurrentCommit,
} from "~/testing/git-helpers";
import { scenario } from "~/testing/scenario";

describe("patchy repo clone", () => {
  it("should clone a repository", async () => {
    const ctx = await scenario({
      bareRepo: true,
      config: { clones_dir: "repos" },
    });

    const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
    const { result } = await ctx.runCli(
      `patchy repo clone --source-repo ${bareRepoUrl}`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(path.join(ctx.tmpDir, "repos", "bare-repo")).toExist();
  });

  it("should resolve relative source_repo paths from config location, not clones_dir", async () => {
    const tmpDir = generateTmpDir();

    const sourceRepoDir = path.join(tmpDir, "upstream");
    await createLocalRepo({
      dir: sourceRepoDir,
      files: { "SOURCE_MARKER.txt": "correct" },
    });

    const wrongRepoDir = path.join(tmpDir, "clones", "upstream");
    await createLocalRepo({
      dir: wrongRepoDir,
      files: { "WRONG_MARKER.txt": "wrong" },
    });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "clones" },
      jsonConfig: {
        source_repo: "./upstream",
        clones_dir: "./clones/",
      },
    });

    const result = await runCli(`patchy repo clone`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");

    const clonedRepoDir = path.join(tmpDir, "clones", "upstream-1");
    expect(clonedRepoDir).toExist();
    expect(path.join(clonedRepoDir, "SOURCE_MARKER.txt")).toExist();
    expect(path.join(clonedRepoDir, "WRONG_MARKER.txt")).not.toExist();
  });

  it("should resolve parent directory relative paths correctly", async () => {
    const tmpDir = generateTmpDir();

    const sourceRepoDir = path.join(tmpDir, "upstream");
    await createLocalRepo({
      dir: sourceRepoDir,
      files: { "PARENT.txt": "parent" },
    });

    const projectDir = path.join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    await setupTestWithConfig({
      tmpDir: projectDir,
      createDirectories: { clonesDir: "clones" },
      jsonConfig: {
        source_repo: "../upstream",
        clones_dir: "./clones/",
      },
    });

    const result = await runCli(`patchy repo clone`, projectDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");

    const clonedRepoDir = path.join(projectDir, "clones", "upstream");
    expect(clonedRepoDir).toExist();
    expect(path.join(clonedRepoDir, "PARENT.txt")).toExist();
  });

  it("should clone a repository with ref checkout", async () => {
    const ctx = await scenario({
      bareRepo: { branches: ["feature-branch"] },
      config: { clones_dir: "repos" },
    });

    const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
    const { result } = await ctx.runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision feature-branch`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput("Checking out feature-branch");

    const clonedRepoDir = path.join(ctx.tmpDir, "repos", "bare-repo");
    expect(await getCurrentBranch(clonedRepoDir)).toBe("feature-branch");
  });

  it("should clone a repository with base_revision SHA", async () => {
    const ctx = await scenario({
      bareRepo: true,
      config: { clones_dir: "repos" },
    });

    const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
    const git = createTestGitClient({ baseDir: ctx.tmpDir });
    const lsRemoteOutput = await git.raw([
      "ls-remote",
      bareRepoDir,
      "refs/heads/main",
    ]);
    const commitSha = lsRemoteOutput.split("\t")[0];

    const bareRepoUrl = `file://${bareRepoDir}`;
    const { result } = await ctx.runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision ${commitSha}`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput(`Checking out ${commitSha}`);

    const clonedRepoDir = path.join(ctx.tmpDir, "repos", "bare-repo");
    expect(await getCurrentCommit(clonedRepoDir)).toBe(commitSha);
  });

  it("should clone a repository with base_revision tag", async () => {
    const ctx = await scenario({
      bareRepo: true,
      config: { clones_dir: "repos" },
    });

    const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
    const git = createTestGitClient({ baseDir: ctx.tmpDir });
    const lsRemoteOutput = await git.raw([
      "ls-remote",
      bareRepoDir,
      "refs/heads/main",
    ]);
    const commitSha = lsRemoteOutput.split("\t")[0];

    const bareGit = createTestGitClient({ baseDir: bareRepoDir });
    await bareGit.raw(["update-ref", "refs/tags/v1.0.0", commitSha]);

    const bareRepoUrl = `file://${bareRepoDir}`;
    const { result } = await ctx.runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision v1.0.0`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput("Checking out v1.0.0");

    const clonedRepoDir = path.join(ctx.tmpDir, "repos", "bare-repo");
    const git2 = createTestGitClient({ baseDir: clonedRepoDir });
    const tagInfo = await git2.raw(["describe", "--tags", "--exact-match"]);
    expect(tagInfo.trim()).toBe("v1.0.0");
  });

  it("should use verbose output when --verbose is set", async () => {
    const ctx = await scenario({
      bareRepo: true,
      config: { clones_dir: "repos" },
    });

    const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
    const { result } = await ctx.runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --verbose`,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Repository URL:");
    expect(result).toHaveOutput("Clones directory:");
    expect(result).toHaveOutput("Target directory:");
  });

  describe("dry-run", () => {
    it("should not clone when --dry-run is set", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --dry-run`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN] Would clone");
      expect(path.join(ctx.tmpDir, "repos", "bare-repo")).not.toExist();
    });

    it("should show base_revision in dry-run output when --base-revision is set", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision v1.0.0 --dry-run`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput(
        "[DRY RUN] Would checkout base_revision: v1.0.0",
      );
    });
  });

  describe("error cases", () => {
    it("should fail with invalid git URL", async () => {
      const ctx = await scenario({
        config: { clones_dir: "repos" },
      });

      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo not-a-valid-url`,
      );

      expect(result).toFailWith("is invalid");
    });

    it("should use default clones_dir when not specified", async () => {
      const ctx = await scenario({
        rawConfig: {},
      });

      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo https://github.com/user/repo`,
      );

      expect(result).toFailWith("Failed to clone repository");
    });

    it("should use incremented name when target directory exists", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      mkdirSync(path.join(ctx.tmpDir, "repos", "bare-repo"), {
        recursive: true,
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(path.join(ctx.tmpDir, "repos", "bare-repo-1")).toExist();
    });

    it("should use incremented name with multiple conflicts", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      mkdirSync(path.join(ctx.tmpDir, "repos", "bare-repo"), {
        recursive: true,
      });
      mkdirSync(path.join(ctx.tmpDir, "repos", "bare-repo-1"), {
        recursive: true,
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(path.join(ctx.tmpDir, "repos", "bare-repo-2")).toExist();
    });

    it("should fail when remote repository does not exist", async () => {
      const ctx = await scenario({
        config: { clones_dir: "repos" },
      });

      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo file:///nonexistent/repo.git`,
      );

      expect(result).toFailWith("Failed to clone repository");
    });

    it("should fail when base_revision does not exist", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision non-existent-ref`,
      );

      expect(result).toFailWith("Failed to checkout base_revision");
    });
  });

  describe("config save prompt", () => {
    it("should skip prompt in non-TTY mode (e2e tests)", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should skip prompt when target_repo already matches", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos", target_repo: "bare-repo" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should skip prompt in dry-run mode", async () => {
      const ctx = await scenario({
        bareRepo: true,
        config: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --dry-run`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).not.toHaveOutput("target_repo");
    });

    it("should skip prompt when patchy.json does not exist", async () => {
      const ctx = await scenario({ noConfig: true });

      const bareRepoDir = path.join(ctx.tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await createLocalBareRepo({ dir: bareRepoDir });
      const bareRepoUrl = `file://${bareRepoDir}`;

      mkdirSync(path.join(ctx.tmpDir, "repos"), { recursive: true });

      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --clones-dir repos`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
    });

    it("should prompt to save target_repo after clone", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /Save target_repo/, respond: true })
        .runCli(`patchy repo clone --source-repo ${bareRepoUrl}`);

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/Save target_repo/),
          response: true,
        },
      ]);

      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo");
    });

    it("should prompt with incremented name when directory exists", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      mkdirSync(path.join(ctx.tmpDir, "repos", "bare-repo"), {
        recursive: true,
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /bare-repo-1/, respond: true })
        .runCli(`patchy repo clone --source-repo ${bareRepoUrl}`);

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/bare-repo-1/),
          response: true,
        },
      ]);

      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo-1");
    });

    it("should not save target_repo when prompt declined", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /Save target_repo/, respond: false })
        .runCli(`patchy repo clone --source-repo ${bareRepoUrl}`);

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/Save target_repo/),
          response: false,
        },
      ]);

      const config = ctx.config();
      expect(config["target_repo"]).toBeUndefined();
    });

    it("should auto-save target_repo with --yes flag", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --yes`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Updated patchy.json: target_repo");
      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo");
    });

    it("should auto-save incremented name with --yes when directory exists", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      mkdirSync(path.join(ctx.tmpDir, "repos", "bare-repo"), {
        recursive: true,
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --yes`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Updated patchy.json: target_repo");
      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo-1");
    });

    it("should save both target_repo and base_revision with --yes when --base-revision provided", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main --yes`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput(
        "Updated patchy.json: target_repo, base_revision",
      );
      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo");
      expect(config["base_revision"]).toBe("main");
    });

    it("should prompt for both fields when both would change", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /target_repo.*base_revision/, respond: true })
        .runCli(
          `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main`,
        );

      expect(result).toSucceed();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).toMatch(/target_repo.*base_revision/);
      const config = ctx.config();
      expect(config["target_repo"]).toBe("bare-repo");
      expect(config["base_revision"]).toBe("main");
    });

    it("should only prompt for target_repo when --base-revision not provided", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /target_repo/, respond: true })
        .runCli(`patchy repo clone --source-repo ${bareRepoUrl}`);

      expect(result).toSucceed();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).toMatch(/target_repo/);
      expect(prompts[0].message).not.toMatch(/base_revision/);
    });

    it("should skip prompt when base_revision already matches", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos", base_revision: "main" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /target_repo/, respond: true })
        .runCli(
          `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main`,
        );

      expect(result).toSucceed();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).not.toMatch(/base_revision/);
      expect(result).toHaveOutput("Updated patchy.json: target_repo");
    });

    it("should skip prompt entirely when nothing would change", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: {
          clones_dir: "repos",
          target_repo: "bare-repo",
          base_revision: "main",
        },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result } = await ctx.runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main`,
      );

      expect(result).toSucceed();
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should only prompt for base_revision when target_repo already matches", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos", target_repo: "bare-repo" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /base_revision/, respond: true })
        .runCli(
          `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main`,
        );

      expect(result).toSucceed();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).not.toMatch(/target_repo/);
      expect(prompts[0].message).toMatch(/base_revision/);
      expect(result).toHaveOutput("Updated patchy.json: base_revision");
    });

    it("should not save either field when prompt declined", async () => {
      const ctx = await scenario({
        bareRepo: true,
        rawConfig: { clones_dir: "repos" },
      });

      const bareRepoUrl = `file://${path.join(ctx.tmpDir, "bare-repo.git")}`;
      const { result, prompts } = await ctx
        .withPrompts({ confirm: /target_repo/, respond: false })
        .runCli(
          `patchy repo clone --source-repo ${bareRepoUrl} --base-revision main`,
        );

      expect(result).toSucceed();
      expect(prompts).toHaveLength(1);
      const config = ctx.config();
      expect(config["target_repo"]).toBeUndefined();
      expect(config["base_revision"]).toBeUndefined();
    });
  });
});
