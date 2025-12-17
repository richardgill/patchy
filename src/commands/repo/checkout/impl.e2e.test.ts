import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { runCli } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeFileIn,
  writeTestFile,
} from "~/testing/fs-test-utils";
import {
  createBranch,
  createTag,
  getCurrentBranch,
  getCurrentCommit,
  initGitRepoWithCommit,
} from "~/testing/git-helpers";

describe("patchy repo checkout", () => {
  it("should checkout a branch", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput('Successfully checked out "feature-branch"');
    expect(await getCurrentBranch(repoDir)).toBe("feature-branch");
  });

  it("should checkout a tag", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createTag(repoDir, "v1.0.0");
    await createBranch(repoDir, "other-branch");

    const result = await runCli(`patchy repo checkout --ref v1.0.0`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput('Successfully checked out "v1.0.0"');
  });

  it("should checkout a commit SHA", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    const initialCommit = await getCurrentCommit(repoDir);
    await createBranch(repoDir, "other-branch");

    const result = await runCli(
      `patchy repo checkout --ref ${initialCommit}`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput(`Successfully checked out "${initialCommit}"`);
    expect(await getCurrentCommit(repoDir)).toBe(initialCommit);
  });

  it("should fail with invalid git ref", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");

    const result = await runCli(
      `patchy repo checkout --ref non-existent-ref`,
      tmpDir,
    );

    expect(result).toFailWith('Invalid git ref "non-existent-ref"');
    expect(result.stderr).toContain(
      "Please specify a valid branch, tag, or commit SHA",
    );
  });

  it("should fail when working tree has uncommitted changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    await writeFileIn(repoDir, "uncommitted.txt", "dirty content");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch`,
      tmpDir,
    );

    expect(result).toFailWith("has uncommitted changes");
    expect(result.stderr).toContain("Please commit or stash your changes");
  });

  it("should use verbose output when --verbose is set", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "main",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "main",
      },
    });

    const repoDir = ctx.absoluteTargetRepo as string;
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Checking out ref");
    expect(result).toHaveOutput("feature-branch");
  });

  it("should use target-repo from CLI flag", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "custom-repo",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "default-repo",
      },
    });

    const repoDir = path.join(tmpDir, "repos", "custom-repo");
    await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
    await createBranch(repoDir, "feature-branch");

    const result = await runCli(
      `patchy repo checkout --ref feature-branch --target-repo custom-repo`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput('Successfully checked out "feature-branch"');
    expect(await getCurrentBranch(repoDir)).toBe("feature-branch");
  });

  it("should fail when target_repo is missing", async () => {
    const tmpDir = generateTmpDir();
    await writeTestFile(tmpDir, "patchy.json", "{}");

    const result = await runCli(`patchy repo checkout --ref main`, tmpDir);

    expect(result).toFailWith("Missing required parameters");
    expect(result.stderr).toContain("target_repo");
  });

  it("should show --ref as required in help output", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });

    const result = await runCli(`patchy repo checkout --help`, tmpDir);

    expect(result).toHaveOutput("--ref");
    expect(result.stdout).not.toContain("[--ref]");
  });

  describe("dry-run", () => {
    it("should not checkout when --dry-run is set", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const repoDir = ctx.absoluteTargetRepo as string;
      await initGitRepoWithCommit(repoDir, "file.txt", "initial content");
      await createBranch(repoDir, "feature-branch");

      const initialBranch = await getCurrentBranch(repoDir);

      const result = await runCli(
        `patchy repo checkout --ref feature-branch --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("feature-branch");
      expect(await getCurrentBranch(repoDir)).toBe(initialBranch);
    });

    it("should still validate the ref exists in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "main",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "main",
        },
      });

      const repoDir = ctx.absoluteTargetRepo as string;
      await initGitRepoWithCommit(repoDir, "file.txt", "initial content");

      const result = await runCli(
        `patchy repo checkout --ref non-existent-ref --dry-run`,
        tmpDir,
      );

      expect(result).toFailWith('Invalid git ref "non-existent-ref"');
    });
  });
});
