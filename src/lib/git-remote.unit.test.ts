import { describe, expect, it } from "bun:test";
import { getBranches, getLatestTags, type RemoteRef } from "./git-remote";

describe("git-remote helpers", () => {
  const mockRefs: RemoteRef[] = [
    { sha: "abc123", name: "main", type: "branch" },
    { sha: "def456", name: "develop", type: "branch" },
    { sha: "111111", name: "v1.0.0", type: "tag" },
    { sha: "222222", name: "v1.1.0", type: "tag" },
    { sha: "333333", name: "v1.2.0", type: "tag" },
    { sha: "444444", name: "v2.0.0", type: "tag" },
  ];

  describe("getBranches", () => {
    it("should return only branches", () => {
      const branches = getBranches(mockRefs);
      expect(branches).toHaveLength(2);
      expect(branches.every((r) => r.type === "branch")).toBe(true);
      expect(branches.map((r) => r.name)).toEqual(["main", "develop"]);
    });

    it("should return empty array when no branches", () => {
      const tags = mockRefs.filter((r) => r.type === "tag");
      expect(getBranches(tags)).toEqual([]);
    });
  });

  describe("getLatestTags", () => {
    it("should return tags in reverse order", () => {
      const tags = getLatestTags(mockRefs);
      expect(tags).toHaveLength(4);
      expect(tags.map((r) => r.name)).toEqual([
        "v2.0.0",
        "v1.2.0",
        "v1.1.0",
        "v1.0.0",
      ]);
    });

    it("should limit results when limit provided", () => {
      const tags = getLatestTags(mockRefs, 2);
      expect(tags).toHaveLength(2);
      expect(tags.map((r) => r.name)).toEqual(["v2.0.0", "v1.2.0"]);
    });

    it("should return empty array when no tags", () => {
      const branches = mockRefs.filter((r) => r.type === "branch");
      expect(getLatestTags(branches)).toEqual([]);
    });
  });
});
