import { describe, expect, it } from "bun:test";
import { extractRepoName } from "./git";

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
    { url: "", expected: undefined },
    { url: "invalid", expected: undefined },
  ];

  testCases.forEach(({ url, expected }) => {
    it(`extracts "${expected}" from "${url}"`, () => {
      expect(extractRepoName(url)).toBe(expected);
    });
  });
});
