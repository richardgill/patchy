import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { generateTmpDir } from "~/testing/fs-test-utils";
import {
  createTagInBareRepo,
  initBareRepoWithCommit,
  pushBranchToBareRepo,
} from "~/testing/git-helpers";
import { fetchRemoteRefs } from "./git-remote";

describe("fetchRemoteRefs integration", () => {
  it("should parse branches from bare repo", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);

    const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

    const branches = refs.filter((r) => r.type === "branch");
    expect(branches).toHaveLength(1);
    expect(branches[0].name).toBe("main");
    expect(branches[0].sha).toMatch(/^[a-f0-9]{40}$/);
  });

  it("should parse tags from bare repo", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    await createTagInBareRepo(bareRepoDir, "v1.0.0");

    const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

    const tags = refs.filter((r) => r.type === "tag");
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("v1.0.0");
    expect(tags[0].sha).toMatch(/^[a-f0-9]{40}$/);
  });

  it("should parse both branches and tags", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    await pushBranchToBareRepo(bareRepoDir, "develop");
    await createTagInBareRepo(bareRepoDir, "v1.0.0");
    await createTagInBareRepo(bareRepoDir, "v2.0.0");

    const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

    const branches = refs.filter((r) => r.type === "branch");
    const tags = refs.filter((r) => r.type === "tag");

    expect(branches).toHaveLength(2);
    expect(branches.map((b) => b.name).sort()).toEqual(["develop", "main"]);

    expect(tags).toHaveLength(2);
    expect(tags.map((t) => t.name).sort()).toEqual(["v1.0.0", "v2.0.0"]);
  });

  it("should return empty array for repo with no refs", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "empty-bare.git");
    mkdirSync(bareRepoDir, { recursive: true });
    const { simpleGit } = await import("simple-git");
    const git = simpleGit(bareRepoDir);
    await git.init(true);

    const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

    expect(refs).toEqual([]);
  });

  it("should handle repo with only branches (no tags)", async () => {
    const tmpDir = generateTmpDir();
    const bareRepoDir = path.join(tmpDir, "bare-repo.git");
    mkdirSync(bareRepoDir, { recursive: true });
    await initBareRepoWithCommit(bareRepoDir);
    await pushBranchToBareRepo(bareRepoDir, "feature-1");
    await pushBranchToBareRepo(bareRepoDir, "feature-2");

    const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

    const branches = refs.filter((r) => r.type === "branch");
    const tags = refs.filter((r) => r.type === "tag");

    expect(branches).toHaveLength(3);
    expect(tags).toHaveLength(0);
  });

  it("should throw on invalid repo URL", async () => {
    const invalidUrl = "file:///nonexistent/path/to/repo";

    await expect(fetchRemoteRefs(invalidUrl)).rejects.toThrow();
  });

  it("should throw on malformed URL", async () => {
    const malformedUrl = "not-a-valid-url";

    await expect(fetchRemoteRefs(malformedUrl)).rejects.toThrow();
  });
});
