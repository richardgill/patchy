import { describe, expect, it } from "bun:test";
import { acceptDefault, cancel, scenario } from "./scenario";

describe("scenario helper", () => {
  describe("basic usage", () => {
    it("applies patch sets in alphabetical order", async () => {
      const { runCli, fileContent } = await scenario({
        patches: {
          "001-first": { "file1.ts": "content from first" },
          "002-second": { "file2.ts": "content from second" },
        },
      });

      const { result } = await runCli("patchy apply --verbose");

      expect(result).toSucceed();
      expect(fileContent("file1.ts")).toBe("content from first");
      expect(fileContent("file2.ts")).toBe("content from second");
    });

    it("fails when --only patch set doesn't exist", async () => {
      const { runCli } = await scenario({
        patches: {
          "001-first": { "file.ts": "content" },
        },
      });

      const { result } = await runCli("patchy apply --only non-existent-set");

      expect(result).toFailWith("Patch set not found: non-existent-set");
    });
  });

  describe("targetFiles option", () => {
    it("applies diff to existing file", async () => {
      const { runCli, fileContent } = await scenario({
        targetFiles: {
          "existing.ts": "const value = 1;\nconst other = 2;\n",
        },
        patches: {
          "001-fix": {
            "existing.ts.diff": `--- a/existing.ts
+++ b/existing.ts
@@ -1,2 +1,2 @@
-const value = 1;
+const value = 42;
 const other = 2;
`,
          },
        },
      });

      const { result } = await runCli("patchy apply");

      expect(result).toSucceed();
      expect(fileContent("existing.ts")).toBe(
        "const value = 42;\nconst other = 2;\n",
      );
    });
  });

  describe("git option", () => {
    it("creates git repo with initial commit", async () => {
      const { runCli, commits } = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
        },
      });

      const { result } = await runCli("patchy apply --all --verbose");

      expect(result).toSucceed();
      expect(result).toHaveOutput("Committed patch set: 001-first");
      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");
    });

    it("initializes git with targetFiles committed", async () => {
      const { runCli, commits, fileContent } = await scenario({
        git: true,
        targetFiles: {
          "existing.ts": "const value = 1;\n",
        },
        patches: {
          "001-fix": {
            "existing.ts.diff": `--- a/existing.ts
+++ b/existing.ts
@@ -1 +1 @@
-const value = 1;
+const value = 42;
`,
          },
        },
      });

      const { result } = await runCli("patchy apply --all");

      expect(result).toSucceed();
      expect(fileContent("existing.ts")).toBe("const value = 42;\n");
      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-fix");
      expect(commitMessages[1]).toBe("initial commit");
    });
  });

  describe("withPrompts", () => {
    it("handles prompt confirmation for last patch set", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set "002-second"/,
        respond: true,
      });

      const { result } = await runCli("patchy apply --verbose");

      expect(result).toSucceed();
      expect(result).toHaveOutput("Committed patch set: 001-first");
      expect(result).toHaveOutput("Committed patch set: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 002-second");
      expect(commitMessages[1]).toBe("Apply patch set: 001-first");
    });

    it("handles prompt rejection for last patch set", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
          "002-second": { "file2.ts": "content2" },
        },
      });

      const { runCli, commits, gitStatus } = ctx.withPrompts({
        confirm: /Commit changes from patch set "002-second"/,
        respond: false,
      });

      const { result } = await runCli("patchy apply --verbose");

      expect(result).toSucceed();
      expect(result).toHaveOutput("Committed patch set: 001-first");
      expect(result).toHaveOutput("Left patch set uncommitted: 002-second");

      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");

      const status = await gitStatus();
      expect(status).toContain("file2.ts");
    });

    it("supports cancel symbol for rejecting prompts", async () => {
      const ctx = await scenario({
        bareRepo: {
          tags: ["v1.0.0"],
        },
        config: {
          upstream_branch: "main",
        },
      });

      const { runCli } = ctx.withPrompts({
        select: /Select new base/,
        respond: cancel,
      });

      const { result } = await runCli("patchy base");

      expect(result).toFail();
      expect(result.stderr).toContain("cancelled");
    });

    it("supports acceptDefault symbol for accepting default prompt value", async () => {
      const ctx = await scenario({
        git: true,
        patches: {
          "001-first": { "file1.ts": "content1" },
        },
      });

      const { runCli, commits } = ctx.withPrompts({
        confirm: /Commit changes from patch set/,
        respond: acceptDefault,
      });

      const { result } = await runCli("patchy apply --verbose");

      expect(result).toSucceed();
      const commitMessages = await commits();
      expect(commitMessages[0]).toBe("Apply patch set: 001-first");
    });
  });

  describe("config option", () => {
    it("merges custom config with defaults", async () => {
      const { config } = await scenario({
        config: {
          upstream_branch: "main",
          verbose: true,
        },
      });

      const configValues = config();
      expect(configValues["upstream_branch"]).toBe("main");
      expect(configValues["verbose"]).toBe(true);
      expect(configValues["source_repo"]).toBe(
        "https://github.com/example/test-repo.git",
      );
    });
  });

  describe("noConfig option", () => {
    it("skips config file creation", async () => {
      const { runCli } = await scenario({
        noConfig: true,
      });

      const { result } = await runCli("patchy apply");

      expect(result).toFail();
      expect(result.stderr).toContain("Missing required parameters");
    });
  });

  describe("rawConfig option", () => {
    it("uses raw config without merging defaults", async () => {
      const { config } = await scenario({
        rawConfig: {
          custom_field: "custom_value",
          source_repo: "https://custom.repo/test.git",
        },
      });

      const configValues = config();
      expect(configValues["custom_field"]).toBe("custom_value");
      expect(configValues["source_repo"]).toBe("https://custom.repo/test.git");
      expect(configValues["clones_dir"]).toBeUndefined();
    });
  });

  describe("bareRepo option", () => {
    it("creates bare repo with file:// source_repo", async () => {
      const { config } = await scenario({
        bareRepo: true,
      });

      const configValues = config();
      expect(configValues["source_repo"]).toMatch(/^file:\/\//);
    });

    it("allows selecting a tag created in bare repo", async () => {
      const ctx = await scenario({
        bareRepo: {
          tags: ["v1.0.0"],
        },
        config: {
          upstream_branch: "main",
        },
      });

      const { runCli } = ctx.withPrompts({
        select: /Select new base/,
        respond: "v1.0.0",
      });

      const { result } = await runCli("patchy base --verbose");

      expect(result).toSucceed();
      expect(result).toHaveOutput("New base_revision: v1.0.0");
    });
  });

  describe("exists and patchExists helpers", () => {
    it("checks file existence correctly", async () => {
      const { exists, patchExists } = await scenario({
        targetFiles: {
          "existing.ts": "content",
        },
        patches: {
          "001-set": { "patch.ts": "patch content" },
        },
      });

      expect(exists("existing.ts")).toBe(true);
      expect(exists("nonexistent.ts")).toBe(false);
      expect(patchExists("001-set/patch.ts")).toBe(true);
      expect(patchExists("001-set/nonexistent.ts")).toBe(false);
    });
  });
});
