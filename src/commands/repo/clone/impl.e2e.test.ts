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
      `patchy repo clone --repo-url ${bareRepoUrl}`,
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
      `patchy repo clone --repo-url ${bareRepoUrl} --ref feature-branch`,
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
      `patchy repo clone --repo-url ${bareRepoUrl} --verbose`,
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
        `patchy repo clone --repo-url ${bareRepoUrl} --dry-run`,
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
        `patchy repo clone --repo-url ${bareRepoUrl} --ref v1.0.0 --dry-run`,
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
        `patchy repo clone --repo-url not-a-valid-url`,
        tmpDir,
      );

      expect(result).toFailWith("is invalid");
    });

    it("should use default clones_dir when not specified", async () => {
      const tmpDir = generateTmpDir();
      await writeTestFile(tmpDir, "patchy.json", "{}");

      const result = await runCli(
        `patchy repo clone --repo-url https://github.com/user/repo`,
        tmpDir,
      );

      // Uses default ./clones/ dir, but clone still fails because it's a non-existent repo
      expect(result).toFailWith("Failed to clone repository");
    });

    it("should fail when target directory already exists", async () => {
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
        `patchy repo clone --repo-url ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toFailWith("Target directory already exists");
    });

    it("should fail when remote repository does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --repo-url file:///nonexistent/repo.git`,
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
        `patchy repo clone --repo-url ${bareRepoUrl} --ref non-existent-ref`,
        tmpDir,
      );

      expect(result).toFailWith("Failed to checkout ref");
    });
  });

  describe("repo_dir prompt", () => {
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
        `patchy repo clone --repo-url ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
      expect(result).not.toHaveOutput("Updated patchy.json");
    });

    it("should skip prompt when repo_dir already matches", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
        jsonConfig: { clones_dir: "repos", repo_dir: "bare-repo" },
      });

      const result = await runCli(
        `patchy repo clone --repo-url ${bareRepoUrl}`,
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
        `patchy repo clone --repo-url ${bareRepoUrl} --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).not.toHaveOutput("repo_dir");
    });

    it("should skip prompt when patchy.json does not exist", async () => {
      const tmpDir = generateTmpDir();
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      mkdirSync(path.join(tmpDir, "repos"), { recursive: true });

      const result = await runCli(
        `patchy repo clone --repo-url ${bareRepoUrl} --clones-dir repos`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully cloned repository");
    });

    it("should prompt to save repo_dir after clone", async () => {
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

      const { resultPromise, tester } = runCliWithPrompts(
        `patchy repo clone --repo-url ${bareRepoUrl}`,
        tmpDir,
      );

      // Confirm saving repo_dir - accept default (yes)
      tester.press("return");

      const result = await resultPromise;
      expect(result).toSucceed();

      // Verify repo_dir was saved to config
      const configPath = path.join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.repo_dir).toBe("bare-repo");
    });

    it("should not save repo_dir when prompt declined", async () => {
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

      const { resultPromise, tester } = runCliWithPrompts(
        `patchy repo clone --repo-url ${bareRepoUrl}`,
        tmpDir,
      );

      // Decline saving repo_dir - move to "no" and confirm
      tester.press("right");
      tester.press("return");

      const result = await resultPromise;
      expect(result).toSucceed();

      // Verify repo_dir was NOT saved
      const configPath = path.join(tmpDir, "patchy.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.repo_dir).toBeUndefined();
    });
  });
});
