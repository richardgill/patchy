import { describe, expect, it } from "bun:test";
import {
  buildBaseRevisionOptions,
  getBranches,
  getLatestTags,
  MANUAL_SHA_OPTION,
  type RemoteRef,
} from "./git-remote";

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

  describe("buildBaseRevisionOptions", () => {
    const mockTags: RemoteRef[] = [
      {
        sha: "aaa1111222233334444555566667777888899990",
        name: "v1.0.0",
        type: "tag",
      },
      {
        sha: "bbb1111222233334444555566667777888899990",
        name: "v2.0.0",
        type: "tag",
      },
    ];
    const mockBranches: RemoteRef[] = [
      {
        sha: "ccc1111222233334444555566667777888899990",
        name: "main",
        type: "branch",
      },
      {
        sha: "ddd1111222233334444555566667777888899990",
        name: "develop",
        type: "branch",
      },
      {
        sha: "eee1111222233334444555566667777888899990",
        name: "feature",
        type: "branch",
      },
      {
        sha: "fff1111222233334444555566667777888899990",
        name: "release",
        type: "branch",
      },
    ];

    it("should build options from tags only", () => {
      const options = buildBaseRevisionOptions(mockTags, []);
      expect(options).toHaveLength(3); // 2 tags + manual
      expect(options[0]).toEqual({
        value: "aaa1111222233334444555566667777888899990",
        label: "v1.0.0 (aaa1111)",
      });
      expect(options[1]).toEqual({
        value: "bbb1111222233334444555566667777888899990",
        label: "v2.0.0 (bbb1111)",
      });
      expect(options[2]).toEqual({
        value: MANUAL_SHA_OPTION,
        label: "Enter SHA or tag manually",
      });
    });

    it("should build options from branches only", () => {
      const options = buildBaseRevisionOptions([], mockBranches);
      // Default branchLimit is 3
      expect(options).toHaveLength(4); // 3 branches (limited) + manual
      expect(options[0]).toEqual({
        value: "ccc1111222233334444555566667777888899990",
        label: "ccc1111 ← main HEAD - pinned, main keeps moving",
      });
      expect(options[1].label).toContain("← develop HEAD");
      expect(options[2].label).toContain("← feature HEAD");
      expect(options[3].value).toBe(MANUAL_SHA_OPTION);
    });

    it("should build options from both tags and branches", () => {
      const options = buildBaseRevisionOptions(mockTags, mockBranches);
      // 2 tags + 3 branches (limited) + manual = 6
      expect(options).toHaveLength(6);
      expect(options[0].label).toBe("v1.0.0 (aaa1111)");
      expect(options[1].label).toBe("v2.0.0 (bbb1111)");
      expect(options[2].label).toContain("← main HEAD");
      expect(options[5].value).toBe(MANUAL_SHA_OPTION);
    });

    it("should respect branchLimit option", () => {
      const options = buildBaseRevisionOptions(mockTags, mockBranches, {
        branchLimit: 1,
      });
      // 2 tags + 1 branch + manual = 4
      expect(options).toHaveLength(4);
      expect(options[2].label).toContain("← main HEAD");
      expect(options[3].value).toBe(MANUAL_SHA_OPTION);
    });

    it("should use custom manual label", () => {
      const options = buildBaseRevisionOptions([], [], {
        manualLabel: "Custom manual option",
      });
      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        value: MANUAL_SHA_OPTION,
        label: "Custom manual option",
      });
    });

    it("should truncate SHA to 7 characters", () => {
      const longShaTags: RemoteRef[] = [
        {
          sha: "abcdef1234567890abcdef1234567890abcdef12",
          name: "v3.0.0",
          type: "tag",
        },
      ];
      const options = buildBaseRevisionOptions(longShaTags, []);
      expect(options[0].label).toBe("v3.0.0 (abcdef1)");
    });

    it("should include warning text for branch tips", () => {
      const options = buildBaseRevisionOptions([], mockBranches);
      for (const opt of options.filter((o) => o.value !== MANUAL_SHA_OPTION)) {
        expect(opt.label).toContain("keeps moving");
      }
    });

    it("should always include manual SHA option", () => {
      const emptyOptions = buildBaseRevisionOptions([], []);
      expect(emptyOptions).toHaveLength(1);
      expect(emptyOptions[0].value).toBe(MANUAL_SHA_OPTION);
    });
  });
});
