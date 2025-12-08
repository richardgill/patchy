import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertFailedCommand,
  assertSuccessfulCommand,
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

const getCleanTestGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("GIT_") && key !== "LEFTHOOK",
    ),
  );

const testGitClient = (repoDir: string) =>
  simpleGit({
    baseDir: repoDir,
    binary: "git",
    maxConcurrentProcesses: 6,
  }).env({ ...getCleanTestGitEnv(), LEFTHOOK: "0" });

const initGitRepo = async (repoDir: string): Promise<void> => {
  const git = testGitClient(repoDir);
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");
  writeFileSync(path.join(repoDir, "file.txt"), "initial content");
  await git.add(".");
  await git.commit("initial commit");
};

const createBranch = async (
  repoDir: string,
  branchName: string,
): Promise<void> => {
  const git = testGitClient(repoDir);
  await git.checkoutLocalBranch(branchName);
  writeFileSync(
    path.join(repoDir, "branch-file.txt"),
    `content from ${branchName}`,
  );
  await git.add(".");
  await git.commit(`commit on ${branchName}`);
  await git.checkout("-");
};

const createTag = async (repoDir: string, tagName: string): Promise<void> => {
  const git = testGitClient(repoDir);
  await git.addTag(tagName);
};

const getCurrentBranch = async (repoDir: string): Promise<string> => {
  const git = testGitClient(repoDir);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
};

const getCurrentCommit = async (repoDir: string): Promise<string> => {
  const git = testGitClient(repoDir);
  const commit = await git.revparse(["HEAD"]);
  return commit.trim();
};

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
    await initGitRepo(repoDir);
    await createBranch(repoDir, "feature-branch");

    const result = await assertSuccessfulCommand(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

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
    await initGitRepo(repoDir);
    await createTag(repoDir, "v1.0.0");
    await createBranch(repoDir, "other-branch");

    const result = await assertSuccessfulCommand(
      `patchy repo checkout --ref v1.0.0`,
      tmpDir,
    );

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
    await initGitRepo(repoDir);
    const initialCommit = await getCurrentCommit(repoDir);
    await createBranch(repoDir, "other-branch");

    const result = await assertSuccessfulCommand(
      `patchy repo checkout --ref ${initialCommit}`,
      tmpDir,
    );

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
    await initGitRepo(repoDir);

    const result = await assertFailedCommand(
      `patchy repo checkout --ref non-existent-ref`,
      tmpDir,
    );

    expect(result.stderr).toContain(
      'Error: Invalid git ref "non-existent-ref"',
    );
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
    await initGitRepo(repoDir);
    await createBranch(repoDir, "feature-branch");

    writeFileSync(path.join(repoDir, "uncommitted.txt"), "dirty content");

    const result = await assertFailedCommand(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stderr)).toContain(
      "has uncommitted changes",
    );
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
    await initGitRepo(repoDir);
    await createBranch(repoDir, "feature-branch");

    const result = await assertSuccessfulCommand(
      `patchy repo checkout --ref feature-branch --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toContain("Checking out ref");
    expect(stabilizeTempDir(result.stdout)).toContain("feature-branch");
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
    await initGitRepo(repoDir);
    await createBranch(repoDir, "feature-branch");

    const result = await assertSuccessfulCommand(
      `patchy repo checkout --ref feature-branch --repo-dir custom-repo`,
      tmpDir,
    );

    expect(result.stdout).toContain(
      'Successfully checked out "feature-branch"',
    );
    expect(await getCurrentBranch(repoDir)).toBe("feature-branch");
  });

  it("should fail when repo_dir is missing", async () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(path.join(tmpDir, "patchy.json"), "{}");

    const result = await assertFailedCommand(
      `patchy repo checkout --ref main`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stderr)).toContain(
      "Missing required parameters",
    );
    expect(result.stderr).toContain("repo_base_dir");
    expect(result.stderr).toContain("repo_dir");
  });

  it("should show --ref as required in help output", async () => {
    mkdirSync(tmpDir, { recursive: true });

    const result = await runCli(`patchy repo checkout --help`, tmpDir);

    expect(result.stdout).toContain("--ref");
    expect(result.stdout).not.toContain("[--ref]");
  });
});
