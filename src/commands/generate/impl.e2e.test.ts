import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { CREATE_NEW_OPTION } from "~/commands/generate/impl";
import { writeFileIn } from "~/testing/fs-test-utils";
import { cancel, scenario } from "~/testing/scenario";

describe("patchy generate", () => {
  it("should detect and generate diff for modified files", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    expect(ctx.patchExists("001-test/initial.txt.diff")).toBe(true);

    const diffContent = ctx.patchFile("001-test/initial.txt.diff");
    expect(diffContent).toContain("-initial content");
    expect(diffContent).toContain("+modified content");
  });

  it("should detect and copy new files", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "newfile.txt",
      "new file content\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: newfile.txt");

    expect(ctx.patchFile("001-test/newfile.txt")).toBe("new file content\n");
  });

  it("should handle nested directory structure", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "src/components/Button.tsx",
      "export const Button = () => <button />\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: src/components/Button.tsx");

    expect(ctx.patchExists("001-test/src/components/Button.tsx")).toBe(true);
  });

  it("should handle both modified and new files", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    const repoDir = path.join(ctx.tmpDir, "repos/main");
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Copied new file: newfile.txt");
    expect(result).toHaveOutput("Generated 2 patch(es) successfully");
  });

  it("should show dry-run output without making changes", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    const repoDir = path.join(ctx.tmpDir, "repos/main");
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const { result } = await ctx.runCli(
      "patchy generate --patch-set 001-test --dry-run",
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "[DRY RUN] Would generate patches from ./main to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Found 2 change(s):");
    expect(result).toHaveOutput("diff: initial.txt");
    expect(result).toHaveOutput("copy: newfile.txt");

    expect(ctx.patchExists("001-test/initial.txt.diff")).toBe(false);
    expect(ctx.patchExists("001-test/newfile.txt")).toBe(false);
  });

  it("should report no changes when repository is clean", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("No changes detected in repository");
  });

  it("should fail when required fields are missing", async () => {
    const ctx = await scenario({
      rawConfig: {
        verbose: true,
      },
    });

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should fail when target_repo does not exist", async () => {
    const ctx = await scenario({
      config: {
        target_repo: "non-existent-repo",
      },
    });

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Validation errors:

      target_repo: non-existent-repo in ./patchy.json does not exist: <TEST_DIR>/repos/non-existent-repo"
    `);
  });

  it("should create patches directory if it does not exist", async () => {
    const ctx = await scenario({
      git: true,
      config: {
        patches_dir: "new-patches",
      },
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    const patchesDir = path.join(ctx.tmpDir, "new-patches");
    expect(patchesDir).toExist();
    expect(path.join(patchesDir, "001-test", "initial.txt.diff")).toExist();
  });

  it("should handle verbose flag", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli(
      "patchy generate --patch-set 001-test --verbose",
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
  });

  it("should remove stale patches that no longer have changes", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      patches: {
        "001-test": {
          "stale-file.txt.diff": "old diff content\n",
          "another-stale.txt": "old file content\n",
        },
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: stale-file.txt.diff");
    expect(result).toHaveOutput("Removed stale: another-stale.txt");
    expect(result).toHaveOutput("removed 2 stale");

    expect(ctx.patchExists("001-test/stale-file.txt.diff")).toBe(false);
    expect(ctx.patchExists("001-test/another-stale.txt")).toBe(false);
    expect(ctx.patchExists("001-test/initial.txt.diff")).toBe(true);
  });

  it("should show stale patches in dry-run output", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      patches: {
        "001-test": {
          "stale-file.txt.diff": "old diff content\n",
        },
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli(
      "patchy generate --patch-set 001-test --dry-run",
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Would remove 1 stale patch(es)");
    expect(result).toHaveOutput("remove: stale-file.txt.diff");

    expect(ctx.patchExists("001-test/stale-file.txt.diff")).toBe(true);
  });

  it("should remove stale patches in nested directories", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      patches: {
        "001-test": {
          "src/old/stale.txt.diff": "old diff\n",
        },
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: src/old/stale.txt.diff");
    expect(ctx.patchExists("001-test/src/old/stale.txt.diff")).toBe(false);
  });

  it("should remove stale patches even when repo has no changes", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      patches: {
        "001-test": {
          "stale-file.txt.diff": "old diff content\n",
        },
      },
    });

    const { result } = await ctx.runCli("patchy generate --patch-set 001-test");

    expect(result).toSucceed();
    expect(result).toHaveOutput("No changes detected in repository");
    expect(result).toHaveOutput("Removed stale: stale-file.txt.diff");
    expect(ctx.patchExists("001-test/stale-file.txt.diff")).toBe(false);
  });

  it("should use patch_set from config", async () => {
    const ctx = await scenario({
      git: true,
      config: {
        patch_set: "001-from-config",
      },
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate");

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-from-config/",
    );
    expect(ctx.patchExists("001-from-config/initial.txt.diff")).toBe(true);
  });

  it("should use PATCHY_PATCH_SET env var", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      env: { PATCHY_PATCH_SET: "001-from-env" },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli("patchy generate");

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-from-env/",
    );
    expect(ctx.patchExists("001-from-env/initial.txt.diff")).toBe(true);
  });

  it("should fail in non-interactive mode without patch set", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    const { result } = await ctx.runCli("patchy generate");

    expect(result).toFail();
    expect(result.stderr).toContain(
      "No patch set specified. Use --patch-set, PATCHY_PATCH_SET env var, or set patch_set in config.",
    );
  });

  it("should prompt for new patch set name when no patch sets exist", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result, prompts } = await ctx
      .withPrompts({ text: "New patch set name:", respond: "security-fixes" })
      .runCli("patchy generate");

    expect(result).toSucceed();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      type: "text",
      message: "New patch set name:",
      response: "security-fixes",
    });
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-security-fixes/",
    );
    expect(ctx.patchExists("001-security-fixes/initial.txt.diff")).toBe(true);
  });

  it("should prompt to select existing patch set or create new", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    mkdirSync(path.join(ctx.tmpDir, "patches/001-existing"), {
      recursive: true,
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result, prompts } = await ctx
      .withPrompts({ select: "Select patch set:", respond: "001-existing" })
      .runCli("patchy generate");

    expect(result).toSucceed();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      type: "select",
      message: "Select patch set:",
      response: "001-existing",
    });
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/001-existing/",
    );
    expect(ctx.patchExists("001-existing/initial.txt.diff")).toBe(true);
  });

  it("should allow creating new patch set from select prompt", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    mkdirSync(path.join(ctx.tmpDir, "patches/001-existing"), {
      recursive: true,
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result, prompts } = await ctx
      .withPrompts(
        { select: "Select patch set:", respond: CREATE_NEW_OPTION },
        { text: "New patch set name:", respond: "new-feature" },
      )
      .runCli("patchy generate");

    expect(result).toSucceed();
    expect(prompts).toHaveLength(2);
    expect(result).toHaveOutput(
      "Generating patches from ./main to ./patches/002-new-feature/",
    );
    expect(ctx.patchExists("002-new-feature/initial.txt.diff")).toBe(true);
  });

  it("should handle cancelled text prompt", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    const { result } = await ctx
      .withPrompts({ text: "New patch set name:", respond: cancel })
      .runCli("patchy generate");

    expect(result).toFail();
    expect(result.stderr).toContain("Operation cancelled");
  });

  it("should handle cancelled select prompt", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    mkdirSync(path.join(ctx.tmpDir, "patches/001-existing"), {
      recursive: true,
    });

    const { result } = await ctx
      .withPrompts({ select: "Select patch set:", respond: cancel })
      .runCli("patchy generate");

    expect(result).toFail();
    expect(result.stderr).toContain("Operation cancelled");
  });

  it("should show patch set options in correct order: create new first, then newest to oldest", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
    });

    mkdirSync(path.join(ctx.tmpDir, "patches/001-first"), { recursive: true });
    mkdirSync(path.join(ctx.tmpDir, "patches/002-second"), { recursive: true });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { prompts } = await ctx
      .withPrompts({ select: "Select patch set:", respond: "001-first" })
      .runCli("patchy generate");

    expect(prompts[0]).toMatchObject({
      type: "select",
      options: [
        { value: CREATE_NEW_OPTION, label: "Create new patch set" },
        { value: "002-second", label: "002-second" },
        { value: "001-first", label: "001-first" },
      ],
    });
  });

  describe("CI mode (CI=true)", () => {
    it("should fail with helpful message when patch-set not provided", async () => {
      const ctx = await scenario({
        bareRepo: true,
        git: true,
        env: { CI: "true" },
      });

      const { result } = await ctx.runCli("patchy generate");

      expect(result).toFail();
      expect(result.stderr).toContain("--patch-set");
    });

    it("should succeed when patch-set is provided", async () => {
      const ctx = await scenario({
        bareRepo: true,
        git: true,
        env: { CI: "true" },
      });

      const { result } = await ctx.runCli("patchy generate --patch-set test");

      expect(result).toSucceed();
    });
  });

  it("should only clean stale patches within the target patch set", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "initial.txt": "initial content\n",
      },
      patches: {
        "001-target": {
          "stale.txt.diff": "stale content\n",
        },
        "002-other": {
          "should-remain.txt.diff": "keep this\n",
        },
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "initial.txt",
      "modified content\n",
    );

    const { result } = await ctx.runCli(
      "patchy generate --patch-set 001-target",
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: stale.txt.diff");

    expect(ctx.patchExists("001-target/stale.txt.diff")).toBe(false);
    expect(ctx.patchExists("002-other/should-remain.txt.diff")).toBe(true);
  });

  it("should not delete hook files during cleanup", async () => {
    const ctx = await scenario({
      git: true,
      targetFiles: {
        "file.txt": "original\n",
      },
      patches: {
        "001-my-set": {
          "file.txt.diff": "old diff\n",
        },
      },
      hooks: {
        "001-my-set": {
          pre: "#!/bin/bash\necho test",
        },
      },
    });

    await writeFileIn(
      path.join(ctx.tmpDir, "repos/main"),
      "file.txt",
      "modified\n",
    );

    const { result } = await ctx.runCli(
      "patchy generate --patch-set 001-my-set",
    );

    expect(result).toSucceed();
    expect(ctx.patchExists("001-my-set/patchy-pre-apply")).toBe(true);
  });
});
