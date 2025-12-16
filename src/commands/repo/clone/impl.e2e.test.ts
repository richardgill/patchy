import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  getCurrentBranch,
  initBareRepoWithCommit,
  pushBranchToBareRepo,
} from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  runCliWithPrompts,
  setupTestWithConfig,
  writeTestFile,
} from "~/testing/test-utils";

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
      `patchy repo clone --source-repo ${bareRepoUrl} --ref feature-branch`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Successfully cloned repository");
    expect(result).toHaveOutput("Checking out feature-branch");

    const clonedRepoDir = path.join(tmpDir, "repos", "bare-repo");
    expect(await getCurrentBranch(clonedRepoDir)).toBe("feature-branch");
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

    it("should show ref in dry-run output when --ref is set", async () => {
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
        `patchy repo clone --source-repo ${bareRepoUrl} --ref v1.0.0 --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN] Would checkout ref: v1.0.0");
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

    it("should fail when ref does not exist", async () => {
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
        `patchy repo clone --source-repo ${bareRepoUrl} --ref non-existent-ref`,
        tmpDir,
      );

      expect(result).toFailWith("Failed to checkout ref");
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
