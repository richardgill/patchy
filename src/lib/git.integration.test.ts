import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateTmpDir, writeFileIn } from "~/testing/fs-test-utils";
import {
  commitFile,
  createLocalRepo,
  getCurrentCommit,
} from "~/testing/git-helpers";
import { hardResetRepo } from "./git";

describe("hardResetRepo", () => {
  it("should reset to specified revision", async () => {
    const repoDir = await createLocalRepo();
    const baseCommit = await getCurrentCommit(repoDir);

    await commitFile(repoDir, "new-file.txt", "new content");
    const newCommit = await getCurrentCommit(repoDir);
    expect(newCommit).not.toBe(baseCommit);

    await hardResetRepo(repoDir, baseCommit);

    expect(await getCurrentCommit(repoDir)).toBe(baseCommit);
  });

  it("should discard uncommitted changes to tracked files", async () => {
    const repoDir = await createLocalRepo({
      files: { "tracked.txt": "original content" },
    });
    const baseCommit = await getCurrentCommit(repoDir);

    await writeFileIn(repoDir, "tracked.txt", "modified content");

    await hardResetRepo(repoDir, baseCommit);

    expect(join(repoDir, "tracked.txt")).toHaveFileContent("original content");
  });

  it("should remove untracked files", async () => {
    const repoDir = await createLocalRepo();
    const baseCommit = await getCurrentCommit(repoDir);

    await writeFileIn(repoDir, "untracked.txt", "untracked content");
    expect(join(repoDir, "untracked.txt")).toExist();

    await hardResetRepo(repoDir, baseCommit);

    expect(join(repoDir, "untracked.txt")).not.toExist();
  });

  it("should remove untracked directories", async () => {
    const repoDir = await createLocalRepo();
    const baseCommit = await getCurrentCommit(repoDir);

    await writeFileIn(repoDir, "untracked-dir/file.txt", "content");
    expect(join(repoDir, "untracked-dir")).toExist();

    await hardResetRepo(repoDir, baseCommit);

    expect(join(repoDir, "untracked-dir")).not.toExist();
  });

  it("should handle nested untracked directories", async () => {
    const repoDir = await createLocalRepo();
    const baseCommit = await getCurrentCommit(repoDir);

    await writeFileIn(repoDir, "level1/level2/level3/deep-file.txt", "content");

    await hardResetRepo(repoDir, baseCommit);

    expect(join(repoDir, "level1")).not.toExist();
  });

  it("should throw for invalid revision", async () => {
    const repoDir = await createLocalRepo();

    await expect(hardResetRepo(repoDir, "nonexistent-sha")).rejects.toThrow();
  });

  it("should throw for non-git directory", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });

    await expect(hardResetRepo(tmpDir, "HEAD")).rejects.toThrow(
      "Not a git repository",
    );
  });
});
