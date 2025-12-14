import { describe, expect, it } from "bun:test";
import { extractRepoName, normalizeGitignoreEntry } from "./git";

describe("extractRepoName", () => {
  const testCases: { url: string; expected: string | undefined }[] = [
    { url: "https://github.com/user/repo.git", expected: "repo" },
    { url: "https://github.com/user/repo", expected: "repo" },
    { url: "https://github.com/org/my-repo.git", expected: "my-repo" },
    { url: "https://gitlab.com/group/subgroup/repo.git", expected: "repo" },
    { url: "git@github.com:user/repo.git", expected: "repo" },
    { url: "git@github.com:user/repo", expected: "repo" },
    { url: "git@gitlab.com:org/my-repo.git", expected: "my-repo" },
    { url: "git@bitbucket.org:team/project.git", expected: "project" },
    { url: "https://github.com/user/repo.name.git", expected: "repo.name" },
    { url: "git@github.com:user/repo.name.git", expected: "repo.name" },
    { url: "file:///path/to/repo.git", expected: "repo" },
    { url: "file:///home/user/repos/my-repo", expected: "my-repo" },
    { url: "file:///tmp/test-repo.git", expected: "test-repo" },
    { url: "", expected: undefined },
    { url: "invalid", expected: undefined },
  ];

  testCases.forEach(({ url, expected }) => {
    it(`extracts "${expected}" from "${url}"`, () => {
      expect(extractRepoName(url)).toBe(expected);
    });
  });
});

describe("normalizeGitignoreEntry", () => {
  const testCases: { entry: string; expected: string }[] = [
    { entry: "clones", expected: "clones/" },
    { entry: "clones/", expected: "clones/" },
    { entry: "./clones", expected: "clones/" },
    { entry: "./clones/", expected: "clones/" },
    { entry: "././clones", expected: "clones/" },
    { entry: "././clones/", expected: "clones/" },
    { entry: "./foo/bar", expected: "foo/bar/" },
    { entry: "foo/bar", expected: "foo/bar/" },
    { entry: "/absolute/path", expected: "/absolute/path/" },
  ];

  testCases.forEach(({ entry, expected }) => {
    it(`normalizes "${entry}" to "${expected}"`, () => {
      expect(normalizeGitignoreEntry(entry)).toBe(expected);
    });
  });
});
