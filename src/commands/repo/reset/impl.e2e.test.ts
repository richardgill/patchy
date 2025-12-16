import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { assertDefined } from "~/lib/assert";
import {
  commitFile,
  initGitRepo,
  initGitRepoWithCommit,
} from "~/testing/git-helpers";
import {
  cancel,
  generateTmpDir,
  runCli,
  runCliWithPrompts,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/test-utils";

describe("patchy repo reset", () => {
  it("should reset repository and discard local changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
    });

    const repoPath = assertDefined(
      ctx.absoluteTargetRepo,
      "absoluteTargetRepo",
    );
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "original content");
    await writeFileIn(repoPath, "test.txt", "modified content");

    expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");

    const result = await runCli(
      `patchy repo reset --clones-dir repos --target-repo test-repo --yes`,
      tmpDir,
    );
    expect(result).toSucceed();

    expect(join(repoPath, "test.txt")).toHaveFileContent("original content");
  });

  it("should show success message after reset", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
    });

    const repoPath = assertDefined(
      ctx.absoluteTargetRepo,
      "absoluteTargetRepo",
    );
    await initGitRepo(repoPath);
    await commitFile(repoPath, "test.txt", "content");

    const result = await runCli(
      `patchy repo reset --clones-dir repos --target-repo test-repo --yes`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result.stdout).toMatchInlineSnapshot(
      `"Successfully reset repository: <TEST_DIR>/repos/test-repo"`,
    );
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", targetRepo: "not-a-repo" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo not-a-repo`,
        tmpDir,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Not a Git repository: <TEST_DIR>/repos/not-a-repo"`,
      );
    });

    it("should fail when clones-dir directory does not exist", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({ tmpDir });

      const result = await runCli(
        `patchy repo reset --target-repo test-repo`,
        tmpDir,
      );

      // Uses default ./clones/, which doesn't exist
      expect(result).toFailWith("does not exist");
    });

    it("should fail when target-repo is missing", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos`,
        tmpDir,
      );

      expect(result).toFailWith("Missing");
    });
  });

  describe("dry-run", () => {
    it("should not reset when --dry-run is set", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos", targetRepo: "test-repo" },
      });

      const repoPath = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepo(repoPath);
      await commitFile(repoPath, "test.txt", "original content");
      await writeFileIn(repoPath, "test.txt", "modified content");

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo test-repo --dry-run`,
        tmpDir,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("Would hard reset");

      expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");
    });

    it("should still validate repo exists in dry-run mode", async () => {
      const tmpDir = generateTmpDir();
      await setupTestWithConfig({
        tmpDir,
        createDirectories: { clonesDir: "repos" },
      });

      const result = await runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent --dry-run`,
        tmpDir,
      );

      expect(result).toFailWith("does not exist");
    });
  });

  describe("confirmation prompt", () => {
    it("should reset when user confirms", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      // Make uncommitted changes
      await writeFileIn(repoDir, "dirty.txt", "uncommitted changes");

      const { result, prompts } = await runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      )
        .on({ confirm: /discard all uncommitted/, respond: true })
        .run();

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully reset");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/discard all uncommitted/),
          response: true,
        },
      ]);
    });

    it("should cancel when user declines", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      const { result, prompts } = await runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      )
        .on({ confirm: /discard all uncommitted/, respond: false })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/discard all uncommitted/),
          response: false,
        },
      ]);
    });

    it("should cancel when user cancels prompt", async () => {
      const tmpDir = generateTmpDir();
      const ctx = await setupTestWithConfig({
        tmpDir,
        createDirectories: {
          clonesDir: "repos",
          targetRepo: "my-repo",
        },
        jsonConfig: {
          clones_dir: "repos",
          target_repo: "my-repo",
        },
      });

      const repoDir = assertDefined(
        ctx.absoluteTargetRepo,
        "absoluteTargetRepo",
      );
      await initGitRepoWithCommit(repoDir);

      const { result, prompts } = await runCliWithPrompts(
        "patchy repo reset",
        tmpDir,
      )
        .on({ confirm: /discard all uncommitted/, respond: cancel })
        .run();

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(/discard all uncommitted/),
          response: "cancelled",
        },
      ]);
    });
  });
});
