import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTestGitClient } from "~/lib/git";
import { runCli, runCliWithPrompts } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeTestFile,
} from "~/testing/fs-test-utils";
import {
  getCurrentBranch,
  getCurrentCommit,
  initBareRepoWithCommit,
  initGitRepoWithCommit,
  pushBranchToBareRepo,
} from "~/testing/git-helpers";

describe("patchy repo clone", () => {
  it("should clone a repository", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos" },
      jsonConfig: { clones_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --source-repo ${bareRepoUrl}`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(path.join(tmpDir, "repos", "bare-repo")).toExist();
  });

  it("should resolve relative source_repo paths from config location, not clones_dir", async () => {
    const tmpDir = generateTmpDir();

    // Create the "upstream" source repo at project root level
    const sourceRepoDir = path.join(tmpDir, "upstream");
    mkdirSync(sourceRepoDir, { recursive: true });
    await initGitRepoWithCommit(sourceRepoDir, "SOURCE_MARKER.txt", "correct");

    // Create a DIFFERENT repo inside clones_dir with same name
    // This simulates the bug scenario where wrong repo gets cloned
    const wrongRepoDir = path.join(tmpDir, "clones", "upstream");
    mkdirSync(wrongRepoDir, { recursive: true });
    await initGitRepoWithCommit(wrongRepoDir, "WRONG_MARKER.txt", "wrong");

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

    // Verify clone came from the correct source (has SOURCE_MARKER, not WRONG_MARKER)
    const clonedRepoDir = path.join(tmpDir, "clones", "upstream-1");
    expect(clonedRepoDir).toExist();
    expect(path.join(clonedRepoDir, "SOURCE_MARKER.txt")).toExist();
    expect(path.join(clonedRepoDir, "WRONG_MARKER.txt")).not.toExist();
  });

  it("should resolve parent directory relative paths correctly", async () => {
    const tmpDir = generateTmpDir();

    // Create source at parent level
    const sourceRepoDir = path.join(tmpDir, "upstream");
    mkdirSync(sourceRepoDir, { recursive: true });
    await initGitRepoWithCommit(sourceRepoDir, "PARENT.txt", "parent");

    // Create project subdirectory with config
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
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    await pushBranchToBareRepo(bareRepoDir, "feature-branch");

    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos" },
      jsonConfig: { clones_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision feature-branch`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput("Checking out feature-branch");

    const clonedRepoDir = path.join(tmpDir, "repos", "bare-repo");
    expect(await getCurrentBranch(clonedRepoDir)).toBe("feature-branch");
  });

  it("should clone a repository with base_revision SHA", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);

    const tmpWorkDir = path.join(tmpDir, "tmp-work");
    const git = createTestGitClient(tmpDir);
    await git.clone(bareRepoDir, "tmp-work");
    const commitSha = await getCurrentCommit(tmpWorkDir);

    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos" },
      jsonConfig: { clones_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision ${commitSha}`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput(`Checking out ${commitSha}`);

    const clonedRepoDir = path.join(tmpDir, "repos", "bare-repo");
    expect(await getCurrentCommit(clonedRepoDir)).toBe(commitSha);
  });

  it("should clone a repository with base_revision tag", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);

    const tmpWorkDir = path.join(tmpDir, "tmp-work");
    const git = createTestGitClient(tmpDir);
    await git.clone(bareRepoDir, "tmp-work");
    const workGit = createTestGitClient(tmpWorkDir);
    await workGit.addConfig("user.email", "test@test.com");
    await workGit.addConfig("user.name", "Test User");
    await workGit.addTag("v1.0.0");
    await workGit.push(["--tags"]);

    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos" },
      jsonConfig: { clones_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --base-revision v1.0.0`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput("Checking out v1.0.0");

    const clonedRepoDir = path.join(tmpDir, "repos", "bare-repo");
    const git2 = createTestGitClient(clonedRepoDir);
    const tagInfo = await git2.raw(["describe", "--tags", "--exact-match"]);
    expect(tagInfo.trim()).toBe("v1.0.0");
  });

  it("should use verbose output when --verbose is set", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos" },
      jsonConfig: { clones_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --source-repo ${bareRepoUrl} --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Repository URL:");
    expect(result).toHaveOutput("Clones directory:");
    expect(result).toHaveOutput("Target directory:");
  });

  describe("dry-run", () => {
    it("should not clone when --dry-run is set", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN] Would clone");
      expect(path.join(tmpDir, "repos", "bare-repo")).not.toExist();
    });

    it("should show base_revision in dry-run output when --base-revision is set", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision v1.0.0 --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput(
        "[DRY RUN] Would checkout base_revision: v1.0.0",
      );
    });
  });

  describe("error cases", () => {
    it("should fail with invalid git URL", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo not-a-valid-url`,
        tmpDir,
      );

      expect(result).toFailWith("is invalid");
    });

    it("should use default clones_dir when not specified", async () => {
      const tmpDir = generateTmpDir();
      await writeTestFile(tmpDir, "patchy.json", "{}");

      const result = await runCli(
        `patchy repo clone --source-repo https://github.com/user/repo`,
        tmpDir,
      );

      // Uses default ./clones/ dir, but clone still fails because it's a non-existent repo
      expect(result).toFailWith("Failed to clone repository");
    });

    it("should use incremented name when target directory exists", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      mkdirSync(path.join(tmpDir, "repos", "bare-repo"), { recursive: true });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(path.join(tmpDir, "repos", "bare-repo-1")).toExist();
    });

    it("should use incremented name with multiple conflicts", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      mkdirSync(path.join(tmpDir, "repos", "bare-repo"), { recursive: true });
      mkdirSync(path.join(tmpDir, "repos", "bare-repo-1"), { recursive: true });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(path.join(tmpDir, "repos", "bare-repo-2")).toExist();
    });

    it("should fail when remote repository does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo file:///nonexistent/repo.git`,
        tmpDir,
      );

      expect(result).toFailWith("Failed to clone repository");
    });

    it("should fail when base_revision does not exist", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --base-revision non-existent-ref`,
        tmpDir,
      );

      expect(result).toFailWith("Failed to checkout base_revision");
    });
  });

  describe("target_repo prompt", () => {
    it("should skip prompt in non-TTY mode (e2e tests)", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should skip prompt when target_repo already matches", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos", target_repo: "bare-repo" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should skip prompt in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).not.toHaveOutput("target_repo");
    });

    it("should skip prompt when patchy.json does not exist", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      mkdirSync(path.join(tmpDir, "repos"), { recursive: true });

      const result = await runCli(
        `patchy repo clone --source-repo ${bareRepoUrl} --clones-dir repos`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
    });

    it("should prompt to save target_repo after clone", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      )
        .on({ confirm: /Save target_repo/, respond: true })
        .run();

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/Save target_repo/),
          response: true,
        },
      ]);

      // Verify target_repo was saved to config
      const configPath = path.join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.target_repo).toBe("bare-repo");
    });

    it("should prompt with incremented name when directory exists", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      mkdirSync(path.join(tmpDir, "repos", "bare-repo"), { recursive: true });

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      )
        .on({ confirm: /bare-repo-1/, respond: true })
        .run();

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/bare-repo-1/),
          response: true,
        },
      ]);

      const configPath = path.join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.target_repo).toBe("bare-repo-1");
    });

    it("should not save target_repo when prompt declined", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const { result, prompts } = await runCliWithPrompts(
        `patchy repo clone --source-repo ${bareRepoUrl}`,
        tmpDir,
      )
        .on({ confirm: /Save target_repo/, respond: false })
        .run();

      expect(result).toSucceed();
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/Save target_repo/),
          response: false,
        },
      ]);

      // Verify target_repo was NOT saved
      const configPath = path.join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.target_repo).toBeUndefined();
    });
  });
});
