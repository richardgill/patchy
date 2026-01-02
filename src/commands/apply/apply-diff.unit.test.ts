import { describe, expect, it } from "bun:test";
import { applyDiff, applyDiffWithConflicts } from "~/commands/apply/apply-diff";

describe("applyDiff", () => {
  it("should apply a clean patch", () => {
    const original = "const value = 1;\nconst other = 2;\n";
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiff(original, diff, 0);
    expect(result).toBe("const value = 42;\nconst other = 2;\n");
  });

  it("should throw when patch fails to apply", () => {
    const original = "const value = 999;\nconst other = 2;\n";
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    expect(() => applyDiff(original, diff, 0)).toThrow(
      "Patch failed to apply - context does not match",
    );
  });
});

describe("applyDiffWithConflicts", () => {
  it("should return success for clean apply", () => {
    const original = "const value = 1;\nconst other = 2;\n";
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toBe("const value = 42;\nconst other = 2;\n");
    }
  });

  it("should insert conflict markers when content differs", () => {
    const original = "const value = 999;\nconst other = 2;\n";
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "001-fix.diff",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.conflicts).toHaveLength(1);
      expect(result.content).toContain("<<<<<<< current");
      expect(result.content).toContain("=======");
      expect(result.content).toContain(">>>>>>> 001-fix.diff");
      expect(result.content).toContain("const value = 999;");
      expect(result.content).toContain("const value = 42;");
    }
  });

  it("should apply some hunks and mark others as conflicts", () => {
    const original = `const a = 1;
const b = 2;
const c = 3;
const x = 10;
const y = CHANGED;
const z = 12;
`;
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 22;
 const c = 3;
@@ -4,3 +4,3 @@
 const x = 10;
-const y = 11;
+const y = 111;
 const z = 12;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "002-update.diff",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.conflicts).toHaveLength(1);
      expect(result.content).toContain("const b = 22;");
      expect(result.content).toContain("<<<<<<< current");
      expect(result.content).toContain("const y = CHANGED;");
    }
  });

  it("should use exactly 7 characters for conflict markers", () => {
    const original = "const value = 999;\nconst other = 2;\n";
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const lines = result.content.split("\n");
      const openMarker = lines.find((l) => l.startsWith("<<<<<<<"));
      const separator = lines.find((l) => l === "=======");
      const closeMarker = lines.find((l) => l.startsWith(">>>>>>>"));

      expect(openMarker).toMatch(/^<{7} /);
      expect(separator).toBe("=======");
      expect(closeMarker).toMatch(/^>{7} /);
    }
  });

  it("should find exact match beyond 50 line offset window", () => {
    // Create a file where the target content shifted by 60 lines
    const padding = Array.from({ length: 60 }, (_, i) => `// line ${i}`).join(
      "\n",
    );
    const original = `${padding}
const value = 1;
const other = 2;
`;
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain("const value = 42;");
      expect(result.content).not.toContain("<<<<<<<");
    }
  });

  it("should prefer closer match when multiple identical regions exist", () => {
    // File has duplicate sections, patch should apply to the one nearest hint
    const original = `const value = 1;
const other = 2;
// gap
const value = 1;
const other = 2;
`;
    // Patch expects to apply at line 4 (second occurrence)
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -4,2 +4,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const lines = result.content.split("\n");
      // First occurrence should be unchanged
      expect(lines[0]).toBe("const value = 1;");
      // Second occurrence should be changed
      expect(lines[3]).toBe("const value = 42;");
    }
  });

  it("should handle pure insertion hunk (no context lines)", () => {
    const original = "line1\nline2\n";
    // Pure insertion at the start
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -0,0 +1,2 @@
+// header
+// comment
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain("// header");
      expect(result.content).toContain("// comment");
    }
  });

  it("should adjust match position after prior hunk changes offset", () => {
    // First hunk adds 2 lines at the start, shifting everything down
    // Second hunk should find its target at the shifted position
    const original = `const a = 1;
const b = 2;
const c = 3;
const d = 4;
`;
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,4 @@
 const a = 1;
+const a2 = 1.5;
+const a3 = 1.7;
 const b = 2;
@@ -3,2 +5,2 @@
-const c = 3;
+const c = 33;
 const d = 4;
`;
    const result = applyDiffWithConflicts(original, diff, {
      fuzzFactor: 0,
      patchName: "test.diff",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const lines = result.content.split("\n");
      // First hunk added 2 lines, second hunk should still find 'const c = 3;'
      // at its new position (index 4 instead of 2)
      expect(lines[0]).toBe("const a = 1;");
      expect(lines[1]).toBe("const a2 = 1.5;");
      expect(lines[2]).toBe("const a3 = 1.7;");
      expect(lines[3]).toBe("const b = 2;");
      expect(lines[4]).toBe("const c = 33;");
      expect(lines[5]).toBe("const d = 4;");
    }
  });
});
