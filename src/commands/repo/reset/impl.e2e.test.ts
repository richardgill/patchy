import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { createGitClient } from "~/lib/git";
import { writeFileIn } from "~/testing/fs-test-utils";
import { commitFile } from "~/testing/git-helpers";
import { cancel, scenario } from "~/testing/scenario";

describe("patchy repo reset", () => {
  it("should reset repository and discard local changes", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "test.txt": "original content",
      },
    });

    const repoPath = join(ctx.tmpDir, "repos", "main");
    const git = createGitClient({ baseDir: repoPath });
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    await writeFileIn(repoPath, "test.txt", "modified content");

    expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");

    const { result } = await ctx.runCli(
      `patchy repo reset --base-revision ${baseCommit} --yes`,
    );
    expect(result).toSucceed();

    expect(join(repoPath, "test.txt")).toHaveFileContent("original content");
  });

  it("should show success message after reset", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "test.txt": "content",
      },
    });

    const repoPath = join(ctx.tmpDir, "repos", "main");
    const git = createGitClient({ baseDir: repoPath });
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    const { result } = await ctx.runCli(
      `patchy repo reset --base-revision ${baseCommit} --yes`,
    );

    expect(result).toSucceed();
    expect(result.stdout).toContain("Successfully reset repository to");
    expect(result.stdout).toContain(baseCommit);
  });

  it("should reset to base_revision and remove patch commits", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "base.txt": "base content",
      },
    });

    const repoPath = join(ctx.tmpDir, "repos", "main");
    const git = createGitClient({ baseDir: repoPath });
    const baseCommit = (await git.revparse(["HEAD"])).trim();

    // Add patch commits
    await commitFile(repoPath, "patch1.txt", "patch 1");
    await commitFile(repoPath, "patch2.txt", "patch 2");

    // Verify we have 3 commits
    const logBefore = await git.log();
    expect(logBefore.total).toBe(3);

    const { result } = await ctx.runCli(
      `patchy repo reset --base-revision ${baseCommit} --yes`,
    );
    expect(result).toSucceed();

    // Verify we're back to base commit
    const currentCommit = (await git.revparse(["HEAD"])).trim();
    expect(currentCommit).toBe(baseCommit);

    const logAfter = await git.log();
    expect(logAfter.total).toBe(1);

    // Verify patch files are gone
    expect(join(repoPath, "base.txt")).toExist();
    expect(join(repoPath, "patch1.txt")).not.toExist();
    expect(join(repoPath, "patch2.txt")).not.toExist();
  });

  describe("error cases", () => {
    it("should fail when repo directory does not exist", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "repos",
        },
      });

      const { result } = await ctx.runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent --base-revision main`,
      );

      expect(result).toFailWith("does not exist");
    });

    it("should fail when directory is not a git repository", async () => {
      const ctx = await scenario({});

      const { result } = await ctx.runCli(
        `patchy repo reset --base-revision main`,
      );

      expect(result).toFail();
      expect(result.stderr).toMatchInlineSnapshot(
        `"Not a Git repository: <TEST_DIR>/repos/main"`,
      );
    });

    it("should fail when clones-dir directory does not exist", async () => {
      const ctx = await scenario({});

      const { result } = await ctx.runCli(
        `patchy repo reset --target-repo test-repo --base-revision main`,
      );

      // Uses default ./clones/, which doesn't exist
      expect(result).toFailWith("does not exist");
    });

    it("should fail when target-repo is missing", async () => {
      const ctx = await scenario({
        rawConfig: {
          clones_dir: "repos",
        },
      });

      const { result } = await ctx.runCli(
        `patchy repo reset --clones-dir repos --base-revision main`,
      );

      expect(result).toFailWith("Missing");
    });

    it("should fail when base-revision does not exist", async () => {
      const ctx = await scenario({
        git: true,
      });

      const { result } = await ctx.runCli(
        `patchy repo reset --base-revision nonexistent-sha --yes`,
      );

      expect(result).toFail();
      expect(result.stderr).toContain("Failed to reset to base_revision");
      expect(result.stderr).toContain("nonexistent-sha");
    });
  });

  describe("dry-run", () => {
    it("should not reset when --dry-run is set", async () => {
      const ctx = await scenario({
        git: true,
        targetFiles: {
          "test.txt": "original content",
        },
      });

      const repoPath = join(ctx.tmpDir, "repos", "main");
      const git = createGitClient({ baseDir: repoPath });
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      await writeFileIn(repoPath, "test.txt", "modified content");

      const { result } = await ctx.runCli(
        `patchy repo reset --base-revision ${baseCommit} --dry-run`,
      );

      expect(result).toSucceed();
      expect(result).toHaveOutput("[DRY RUN]");
      expect(result).toHaveOutput("Would hard reset repository to");
      expect(result).toHaveOutput(baseCommit);

      expect(join(repoPath, "test.txt")).toHaveFileContent("modified content");
    });

    it("should still validate repo exists in dry-run mode", async () => {
      const ctx = await scenario({
        config: {
          clones_dir: "repos",
        },
      });

      const { result } = await ctx.runCli(
        `patchy repo reset --clones-dir repos --target-repo nonexistent --base-revision main --dry-run`,
      );

      expect(result).toFailWith("does not exist");
    });
  });

  describe("confirmation prompt", () => {
    it("should reset when user confirms", async () => {
      const ctx = await scenario({
        git: true,
        targetFiles: {
          "initial.txt": "initial content",
        },
      });

      const repoPath = join(ctx.tmpDir, "repos", "main");
      const git = createGitClient({ baseDir: repoPath });
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      // Make uncommitted changes
      await writeFileIn(repoPath, "dirty.txt", "uncommitted changes");

      const { result, prompts } = await ctx
        .withPrompts({
          confirm: /discarding all commits and uncommitted changes/,
          respond: true,
        })
        .runCli(`patchy repo reset --base-revision ${baseCommit}`);

      expect(result).toSucceed();
      expect(result).toHaveOutput("Successfully reset");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: true,
        },
      ]);
    });

    it("should cancel when user declines", async () => {
      const ctx = await scenario({
        git: true,
        targetFiles: {
          "initial.txt": "initial content",
        },
      });

      const repoPath = join(ctx.tmpDir, "repos", "main");
      const git = createGitClient({ baseDir: repoPath });
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      const { result, prompts } = await ctx
        .withPrompts({
          confirm: /discarding all commits and uncommitted changes/,
          respond: false,
        })
        .runCli(`patchy repo reset --base-revision ${baseCommit}`);

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: false,
        },
      ]);
    });

    it("should cancel when user cancels prompt", async () => {
      const ctx = await scenario({
        git: true,
        targetFiles: {
          "initial.txt": "initial content",
        },
      });

      const repoPath = join(ctx.tmpDir, "repos", "main");
      const git = createGitClient({ baseDir: repoPath });
      const baseCommit = (await git.revparse(["HEAD"])).trim();

      const { result, prompts } = await ctx
        .withPrompts({
          confirm: /discarding all commits and uncommitted changes/,
          respond: cancel,
        })
        .runCli(`patchy repo reset --base-revision ${baseCommit}`);

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
      expect(prompts).toMatchObject([
        {
          type: "confirm",
          message: expect.stringMatching(
            /discarding all commits and uncommitted changes/,
          ),
          response: "cancelled",
        },
      ]);
    });
  });
});
