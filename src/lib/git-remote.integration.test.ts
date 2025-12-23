import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createTestGitClient } from "~/lib/git";
import { generateTmpDir } from "~/testing/fs-test-utils";
import { createLocalBareRepo, createLocalRepo } from "~/testing/git-helpers";
import { fetchRefs } from "./git-remote";

type RepoSetup = {
  name: string;
  init: "empty" | "with-commit";
  branches: string[];
  tags: string[];
  expectedBranches: string[];
  expectedTags: string[];
};

const createBareRepo = async (setup: RepoSetup): Promise<string> => {
  const tmpDir = generateTmpDir();
  const bareRepoDir = path.join(tmpDir, "bare-repo.git");
  mkdirSync(bareRepoDir, { recursive: true });

  if (setup.init === "empty") {
    await createTestGitClient({ baseDir: bareRepoDir }).init(true);
  } else {
    await createLocalBareRepo({
      dir: bareRepoDir,
      branches: setup.branches,
      tags: setup.tags,
    });
  }

  return bareRepoDir;
};

describe("fetchRefs integration", () => {
  const successCases: RepoSetup[] = [
    {
      name: "repo with only main branch",
      init: "with-commit",
      branches: [],
      tags: [],
      expectedBranches: ["main"],
      expectedTags: [],
    },
    {
      name: "repo with one tag",
      init: "with-commit",
      branches: [],
      tags: ["v1.0.0"],
      expectedBranches: ["main"],
      expectedTags: ["v1.0.0"],
    },
    {
      name: "repo with branches and tags",
      init: "with-commit",
      branches: ["develop"],
      tags: ["v1.0.0", "v2.0.0"],
      expectedBranches: ["develop", "main"],
      expectedTags: ["v1.0.0", "v2.0.0"],
    },
    {
      name: "empty repo with no refs",
      init: "empty",
      branches: [],
      tags: [],
      expectedBranches: [],
      expectedTags: [],
    },
    {
      name: "repo with multiple branches, no tags",
      init: "with-commit",
      branches: ["feature-1", "feature-2"],
      tags: [],
      expectedBranches: ["feature-1", "feature-2", "main"],
      expectedTags: [],
    },
  ];

  successCases.forEach(({ name, expectedBranches, expectedTags, ...setup }) => {
    it(`should parse refs from ${name}`, async () => {
      const bareRepoDir = await createBareRepo({
        name,
        expectedBranches,
        expectedTags,
        ...setup,
      });

      const refs = await fetchRefs(`file://${bareRepoDir}`);

      const branches = refs.filter((r) => r.type === "branch");
      const tags = refs.filter((r) => r.type === "tag");

      expect(branches.map((b) => b.name).sort()).toEqual(
        expectedBranches.sort(),
      );
      expect(tags.map((t) => t.name).sort()).toEqual(expectedTags.sort());

      for (const ref of refs) {
        expect(ref.sha).toMatch(/^[a-f0-9]{40}$/);
      }
    });
  });

  const errorCases = [
    { name: "invalid repo URL", url: "file:///nonexistent/path/to/repo" },
    { name: "malformed URL", url: "not-a-valid-url" },
  ];

  errorCases.forEach(({ name, url }) => {
    it(`should throw on ${name}`, async () => {
      await expect(fetchRefs(url)).rejects.toThrow();
    });
  });

  describe("local path handling", () => {
    const pathFormats = [
      { name: "absolute path", transform: (dir: string) => dir },
      {
        name: "relative path",
        transform: (dir: string) => `./${path.relative(process.cwd(), dir)}`,
      },
      { name: "file:// protocol", transform: (dir: string) => `file://${dir}` },
    ];

    pathFormats.forEach(({ name, transform }) => {
      it(`should fetch refs from ${name}`, async () => {
        const bareRepoDir = await createBareRepo({
          name: "local-path-test",
          init: "with-commit",
          branches: ["develop"],
          tags: ["v1.0.0"],
          expectedBranches: ["develop", "main"],
          expectedTags: ["v1.0.0"],
        });

        const refs = await fetchRefs(transform(bareRepoDir));

        const branches = refs.filter((r) => r.type === "branch");
        expect(branches.map((b) => b.name).sort()).toEqual(["develop", "main"]);
      });
    });

    it("should throw on non-existent path", async () => {
      await expect(fetchRefs("/nonexistent/path/to/repo")).rejects.toThrow();
    });

    it("should throw on path that is not a git repo", async () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });

      await expect(fetchRefs(tmpDir)).rejects.toThrow();
    });

    it("should return empty array for empty bare repo", async () => {
      const bareRepoDir = await createBareRepo({
        name: "empty-local-repo",
        init: "empty",
        branches: [],
        tags: [],
        expectedBranches: [],
        expectedTags: [],
      });

      const refs = await fetchRefs(bareRepoDir);

      expect(refs).toEqual([]);
    });

    it("should fetch refs from non-bare repo with working directory", async () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });
      await createLocalRepo({
        dir: tmpDir,
        branches: ["feature-branch"],
        tags: ["v1.0.0"],
      });

      const refs = await fetchRefs(tmpDir);

      const branches = refs.filter((r) => r.type === "branch");
      const tags = refs.filter((r) => r.type === "tag");

      expect(branches.map((b) => b.name).sort()).toEqual([
        "feature-branch",
        "main",
      ]);
      expect(tags.map((t) => t.name)).toEqual(["v1.0.0"]);
    });
  });
});
