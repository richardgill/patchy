import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createTestGitClient } from "~/lib/git";
import { generateTmpDir } from "~/testing/fs-test-utils";
import {
  createTagInBareRepo,
  initBareRepoWithCommit,
  pushBranchToBareRepo,
} from "~/testing/git-helpers";
import { fetchRemoteRefs } from "./git-remote";

type RepoSetup = {
  name: string;
  init: "empty" | "with-commit";
  branches: string[];
  tags: string[];
  expectedBranches: string[];
  expectedTags: string[];
};

const setupBareRepo = async (setup: RepoSetup): Promise<string> => {
  const tmpDir = generateTmpDir();
  const bareRepoDir = path.join(tmpDir, "bare-repo.git");
  mkdirSync(bareRepoDir, { recursive: true });

  if (setup.init === "empty") {
    await createTestGitClient(bareRepoDir).init(true);
  } else {
    await initBareRepoWithCommit(bareRepoDir);
    for (const branch of setup.branches) {
      await pushBranchToBareRepo(bareRepoDir, branch);
    }
    for (const tag of setup.tags) {
      await createTagInBareRepo(bareRepoDir, tag);
    }
  }

  return bareRepoDir;
};

describe("fetchRemoteRefs integration", () => {
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
      const bareRepoDir = await setupBareRepo({
        name,
        expectedBranches,
        expectedTags,
        ...setup,
      });

      const refs = await fetchRemoteRefs(`file://${bareRepoDir}`);

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
      await expect(fetchRemoteRefs(url)).rejects.toThrow();
    });
  });
});
