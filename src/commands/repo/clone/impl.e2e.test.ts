import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  getCurrentBranch,
  initBareRepoWithCommit,
  pushBranchToBareRepo,
} from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  writeTestFile,
} from "~/testing/test-utils";

describe("patchy repo clone", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  it("should clone a repository", async () => {
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos" },
      jsonConfig: { repo_base_dir: "repos" },
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
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    await pushBranchToBareRepo(bareRepoDir, "feature-branch");

    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos" },
      jsonConfig: { repo_base_dir: "repos" },
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
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    const bareRepoUrl = `file://${bareRepoDir}`;

    await setupTestWithConfig({
      tmpDir,
      createDirectories: { repoBaseDir: "repos" },
      jsonConfig: { repo_base_dir: "repos" },
    });

    const result = await runCli(
      `patchy repo clone --repo-url ${bareRepoUrl} --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Repository URL:");
    expect(result).toHaveOutput("Repository base directory:");
    expect(result).toHaveOutput("Target directory:");
  });

  describe("dry-run", () => {
    it("should not clone when --dry-run is set", async () => {
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
        jsonConfig: { repo_base_dir: "repos" },
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
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
        jsonConfig: { repo_base_dir: "repos" },
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
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
        jsonConfig: { repo_base_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --repo-url not-a-valid-url`,
        tmpDir,
      );

      expect(result).toFailWith("is invalid");
    });

    it("should fail when repo_base_dir is missing", async () => {
      await writeTestFile(tmpDir, "patchy.json", "{}");

      const result = await runCli(
        `patchy repo clone --repo-url https://github.com/user/repo`,
        tmpDir,
      );

      expect(result).toFailWith("Missing required parameter: repo_base_dir");
    });

    it("should fail when target directory already exists", async () => {
      const bareRepoDir = path.join(tmpDir, "bare-repo.git");
      mkdirSync(bareRepoDir, { recursive: true });
      await initBareRepoWithCommit(bareRepoDir);
      const bareRepoUrl = `file://${bareRepoDir}`;

      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
        jsonConfig: { repo_base_dir: "repos" },
      });

      mkdirSync(path.join(tmpDir, "repos", "bare-repo"), { recursive: true });

      const result = await runCli(
        `patchy repo clone --repo-url ${bareRepoUrl}`,
        tmpDir,
      );

      expect(result).toFailWith("Target directory already exists");
    });

    // TODO: Clone command doesn't handle git errors - fix impl to catch and report clone failures
    it.skip("should fail when remote repository does not exist", async () => {
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { repoBaseDir: "repos" },
        jsonConfig: { repo_base_dir: "repos" },
      });

      const result = await runCli(
        `patchy repo clone --repo-url file:///nonexistent/repo.git`,
        tmpDir,
      );

      expect(result).toFail();
    });
  });
});
