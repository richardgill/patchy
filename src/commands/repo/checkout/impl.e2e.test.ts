import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  createBranch,
  createTag,
  getCurrentBranch,
  getCurrentCommit,
  initGitRepoWithCommit,
} from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  writeFileIn,
  writeTestFile,
} from "~/testing/test-utils";

describe("patchy repo checkout", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = generateTmpDir();
  });

  it("should checkout a branch", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain(
      'Successfully checked out "feature-branch"',
    );
    expect(await getCurrentBranch(repoDir)).toBe("feature-branch");
  });

  it("should checkout a tag", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createTag(repoDir, "v1.0.0");
    await createBranch(repoDir, "other-branch");

    const result = await runCli(`patchy repo checkout --ref v1.0.0`, tmpDir);

    expect(result).toSucceed();
    expect(result.stdout).toContain('Successfully checked out "v1.0.0"');
  });

  it("should checkout a commit SHA", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    const initialCommit = await getCurrentCommit(repoDir);
    await createBranch(repoDir, "other-branch");

    const result = await runCli(
      `patchy repo checkout --ref ${initialCommit}`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain(
      `Successfully checked out "${initialCommit}"`,
    );
    expect(await getCurrentCommit(repoDir)).toBe(initialCommit);
  });

  it("should fail with invalid git ref", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");

    const result = await runCli(
      `patchy repo checkout --ref non-existent-ref`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toContain('Invalid git ref "non-existent-ref"');
    expect(result.stderr).toContain(
      "Please specify a valid branch, tag, or commit SHA",
    );
  });

  it("should fail when working tree has uncommitted changes", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    await writeFileIn(repoDir, "uncommitted.txt", "dirty content");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

    expect(result).toFail();
    expect(result.stderr).toContain("has uncommitted changes");
    expect(result.stderr).toContain("Please commit or stash your changes");
  });

  it("should use verbose output when --verbose is set", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "main",
      },
    });

    const repoDir = ctx.absoluteRepoDir as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain("Checking out ref");
    expect(result.stdout).toContain("feature-branch");
  });

  it("should use repo-dir from CLI flag", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "custom-repo",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "default-repo",
      },
    });

    const repoDir = path.join(tmpDir, "repos", "custom-repo");
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch --repo-dir custom-repo`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain(
      'Successfully checked out "feature-branch"',
    );
    expect(await getCurrentBranch(repoDir)).toBe("feature-branch");
  });

  it("should fail when repo_dir is missing", async () => {
    await writeTestFile(tmpDir, "patchy.json", "{}");

    const result = await runCli(`patchy repo checkout --ref main`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toContain("Missing required parameters");
    expect(result.stderr).toContain("repo_base_dir");
    expect(result.stderr).toContain("repo_dir");
  });

  it("should show --ref as required in help output", async () => {
    mkdirSync(tmpDir, { recursive: true });

    const result = await runCli(`patchy repo checkout --help`, tmpDir);

    expect(result.stdout).toContain("--ref");
    expect(result.stdout).not.toContain("[--ref]");
  });

  describe("dry-run", () => {
    it("should not checkout when --dry-run is set", async () => {
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          repoBaseDir: "repos",
          repoDir: "main",
        },
        jsonConfig: {
          repo_base_dir: "repos",
          repo_dir: "main",
        },
      });

      const repoDir = ctx.absoluteRepoDir as string;
      await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
      await createBranch(repoDir, "feature-branch");

      const initialBranch = await getCurrentBranch(repoDir);

      const result = await runCli(
        `patchy repo checkout --ref feature-branch --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result.stdout).toContain("[DRY RUN]");
      expect(result.stdout).toContain("feature-branch");
      expect(await getCurrentBranch(repoDir)).toBe(initialBranch);
    });

    it("should still validate the ref exists in dry-run mode", async () => {
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          repoBaseDir: "repos",
          repoDir: "main",
        },
        jsonConfig: {
          repo_base_dir: "repos",
          repo_dir: "main",
        },
      });

      const repoDir = ctx.absoluteRepoDir as string;
      await initGitRepoWithCommit(repoDir, "file.txt", "initial content");

      const result = await runCli(
        `patchy repo checkout --ref non-existent-ref --dry-run`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toContain('Invalid git ref "non-existent-ref"');
    });
  });
});
