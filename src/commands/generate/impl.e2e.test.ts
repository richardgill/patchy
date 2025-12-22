import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CREATE_NEW_OPTION } from "~/commands/generate/impl";
import { assertDefined } from "~/lib/assert";
import { runCli, runCliWithPrompts } from "~/testing/e2e-utils";
import {
  generateTmpDir,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/fs-test-utils";
import { initGitRepoWithCommit } from "~/testing/git-helpers";
import { cancel } from "~/testing/prompt-testing-types";

describe("patchy generate", () => {
  it("should detect and generate diff for modified files", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    const diffPath = path.join(patchesDir, "001-test", "initial.txt.diff");
    expect(diffPath).toExist();

    const diffContent = readFileSync(diffPath, "utf-8");
    expect(diffContent).toContain("-initial content");
    expect(diffContent).toContain("+modified content");
  });

  it("should detect and copy new files", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: newfile.txt");

    expect(path.join(patchesDir, "001-test", "newfile.txt")).toHaveFileContent(
      "new file content\n",
    );
  });

  it("should handle nested directory structure", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(
      repoDir,
      "src/components/Button.tsx",
      "export const Button = () => <button />\n",
    );

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: src/components/Button.tsx");

    expect(
      path.join(patchesDir, "001-test", "src/components/Button.tsx"),
    ).toExist();
  });

  it("should handle both modified and new files", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Copied new file: newfile.txt");
    expect(result).toHaveOutput("Generated 2 patch(es) successfully");
  });

  it("should show dry-run output without making changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(
      `patchy generate --patch-set 001-test --dry-run`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "[DRY RUN] Would generate patches from ./upstream to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Found 2 change(s):");
    expect(result).toHaveOutput("diff: initial.txt");
    expect(result).toHaveOutput("copy: newfile.txt");

    expect(path.join(patchesDir, "001-test", "initial.txt.diff")).not.toExist();
    expect(path.join(patchesDir, "001-test", "newfile.txt")).not.toExist();
  });

  it("should report no changes when repository is clean", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");

    await initGitRepoWithCommit(repoDir);

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("No changes detected in repository");
  });

  it("should fail when required fields are missing", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
      },
      jsonConfig: {
        verbose: true,
      },
    });

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Target repository: set target_repo in ./patchy.json, PATCHY_TARGET_REPO env var, or --target-repo flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should fail when target_repo does not exist", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "non-existent-repo",
        patches_dir: "patches",
      },
    });

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Validation errors:

      target_repo: non-existent-repo in ./patchy.json does not exist: <TEST_DIR>/repos/non-existent-repo"
    `);
  });

  it("should create patches directory if it does not exist", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "new-patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    const patchesDir = path.join(tmpDir, "new-patches");
    expect(patchesDir).toExist();
    expect(path.join(patchesDir, "001-test", "initial.txt.diff")).toExist();
  });

  it("should handle verbose flag", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(
      `patchy generate --patch-set 001-test --verbose`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-test/",
    );
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
  });

  it("should remove stale patches that no longer have changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);

    await writeFileIn(
      patchesDir,
      "001-test/stale-file.txt.diff",
      "old diff content\n",
    );
    await writeFileIn(
      patchesDir,
      "001-test/another-stale.txt",
      "old file content\n",
    );

    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: stale-file.txt.diff");
    expect(result).toHaveOutput("Removed stale: another-stale.txt");
    expect(result).toHaveOutput("removed 2 stale");

    expect(
      path.join(patchesDir, "001-test", "stale-file.txt.diff"),
    ).not.toExist();
    expect(
      path.join(patchesDir, "001-test", "another-stale.txt"),
    ).not.toExist();

    expect(path.join(patchesDir, "001-test", "initial.txt.diff")).toExist();
  });

  it("should show stale patches in dry-run output", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);

    await writeFileIn(
      patchesDir,
      "001-test/stale-file.txt.diff",
      "old diff content\n",
    );

    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(
      `patchy generate --patch-set 001-test --dry-run`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Would remove 1 stale patch(es)");
    expect(result).toHaveOutput("remove: stale-file.txt.diff");

    expect(path.join(patchesDir, "001-test", "stale-file.txt.diff")).toExist();
  });

  it("should remove stale patches in nested directories", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);

    await writeFileIn(
      patchesDir,
      "001-test/src/old/stale.txt.diff",
      "old diff\n",
    );

    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: src/old/stale.txt.diff");
    expect(
      path.join(patchesDir, "001-test", "src/old/stale.txt.diff"),
    ).not.toExist();
  });

  it("should remove stale patches even when repo has no changes", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);

    await writeFileIn(
      patchesDir,
      "001-test/stale-file.txt.diff",
      "old diff content\n",
    );

    const result = await runCli(`patchy generate --patch-set 001-test`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("No changes detected in repository");
    expect(result).toHaveOutput("Removed stale: stale-file.txt.diff");
    expect(
      path.join(patchesDir, "001-test", "stale-file.txt.diff"),
    ).not.toExist();
  });

  it("should use patch_set from config", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
        patch_set: "001-from-config",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-from-config/",
    );
    expect(
      path.join(patchesDir, "001-from-config", "initial.txt.diff"),
    ).toExist();
  });

  it("should use PATCHY_PATCH_SET env var", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate`, tmpDir, {
      env: { PATCHY_PATCH_SET: "001-from-env" },
    });

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-from-env/",
    );
    expect(path.join(patchesDir, "001-from-env", "initial.txt.diff")).toExist();
  });

  it("should fail in non-interactive mode without patch set", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toContain(
      "No patch set specified. Use --patch-set, PATCHY_PATCH_SET env var, or set patch_set in config.",
    );
  });

  it("should prompt for new patch set name when no patch sets exist", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const { result, prompts } = await runCliWithPrompts(
      `patchy generate`,
      tmpDir,
    )
      .on({ text: "New patch set name:", respond: "security-fixes" })
      .run();

    expect(result).toSucceed();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      type: "text",
      message: "New patch set name:",
      response: "security-fixes",
    });
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-security-fixes/",
    );
    expect(
      path.join(patchesDir, "001-security-fixes", "initial.txt.diff"),
    ).toExist();
  });

  it("should prompt to select existing patch set or create new", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    mkdirSync(path.join(patchesDir, "001-existing"), { recursive: true });

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const { result, prompts } = await runCliWithPrompts(
      `patchy generate`,
      tmpDir,
    )
      .on({ select: "Select patch set:", respond: "001-existing" })
      .run();

    expect(result).toSucceed();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      type: "select",
      message: "Select patch set:",
      response: "001-existing",
    });
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/001-existing/",
    );
    expect(path.join(patchesDir, "001-existing", "initial.txt.diff")).toExist();
  });

  it("should allow creating new patch set from select prompt", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    mkdirSync(path.join(patchesDir, "001-existing"), { recursive: true });

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const { result, prompts } = await runCliWithPrompts(
      `patchy generate`,
      tmpDir,
    )
      .on({ select: "Select patch set:", respond: CREATE_NEW_OPTION })
      .on({ text: "New patch set name:", respond: "new-feature" })
      .run();

    expect(result).toSucceed();
    expect(prompts).toHaveLength(2);
    expect(result).toHaveOutput(
      "Generating patches from ./upstream to ./patches/002-new-feature/",
    );
    expect(
      path.join(patchesDir, "002-new-feature", "initial.txt.diff"),
    ).toExist();
  });

  it("should handle cancelled text prompt", async () => {
    const tmpDir = generateTmpDir();
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const { result } = await runCliWithPrompts(`patchy generate`, tmpDir)
      .on({ text: "New patch set name:", respond: cancel })
      .run();

    expect(result).toFail();
    expect(result.stderr).toContain("Operation cancelled");
  });

  it("should handle cancelled select prompt", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );
    mkdirSync(path.join(patchesDir, "001-existing"), { recursive: true });

    const { result } = await runCliWithPrompts(`patchy generate`, tmpDir)
      .on({ select: "Select patch set:", respond: cancel })
      .run();

    expect(result).toFail();
    expect(result.stderr).toContain("Operation cancelled");
  });

  it("should expose patch set options in recorded prompts", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );
    mkdirSync(path.join(patchesDir, "001-first-patch"), { recursive: true });
    mkdirSync(path.join(patchesDir, "002-second-patch"), { recursive: true });

    const { prompts } = await runCliWithPrompts(`patchy generate`, tmpDir)
      .on({ select: "Select patch set:", respond: cancel })
      .run();

    expect(prompts).toHaveLength(1);
    const selectPrompt = prompts[0];
    expect(selectPrompt.type).toBe("select");

    if (selectPrompt.type === "select") {
      // Verify options include existing patch sets and create new option
      expect(selectPrompt.options).toEqual([
        { value: "001-first-patch", label: "001-first-patch" },
        { value: "002-second-patch", label: "002-second-patch" },
        { value: CREATE_NEW_OPTION, label: "Create new patch set" },
      ]);
    }
  });

  it("should only clean stale patches within the target patch set", async () => {
    const tmpDir = generateTmpDir();
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        clonesDir: "repos",
        targetRepo: "upstream",
      },
      jsonConfig: {
        clones_dir: "repos",
        target_repo: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteTargetRepo, "absoluteTargetRepo");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);

    await writeFileIn(
      patchesDir,
      "001-target/stale.txt.diff",
      "stale content\n",
    );
    await writeFileIn(
      patchesDir,
      "002-other/should-remain.txt.diff",
      "keep this\n",
    );

    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(
      `patchy generate --patch-set 001-target`,
      tmpDir,
    );

    expect(result).toSucceed();
    expect(result).toHaveOutput("Removed stale: stale.txt.diff");

    expect(path.join(patchesDir, "001-target", "stale.txt.diff")).not.toExist();
    expect(
      path.join(patchesDir, "002-other", "should-remain.txt.diff"),
    ).toExist();
  });
});
