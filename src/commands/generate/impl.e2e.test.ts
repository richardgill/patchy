import { beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertDefined } from "~/lib/assert";
import { initGitRepoWithCommit } from "~/testing/git-helpers";
import {
  generateTmpDir,
  runCli,
  setupTestWithConfig,
  writeFileIn,
} from "~/testing/test-utils";

describe("patchy generate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = generateTmpDir();
  });

  it("should detect and generate diff for modified files", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Generating patches from upstream to patches");
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    const diffPath = path.join(patchesDir, "initial.txt.diff");
    expect(diffPath).toExist();

    const diffContent = readFileSync(diffPath, "utf-8");
    expect(diffContent).toContain("-initial content");
    expect(diffContent).toContain("+modified content");
  });

  it("should detect and copy new files", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: newfile.txt");

    expect(path.join(patchesDir, "newfile.txt")).toHaveFileContent(
      "new file content\n",
    );
  });

  it("should handle nested directory structure", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
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

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Copied new file: src/components/Button.tsx");

    expect(path.join(patchesDir, "src/components/Button.tsx")).toExist();
  });

  it("should handle both modified and new files", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
    expect(result).toHaveOutput("Copied new file: newfile.txt");
    expect(result).toHaveOutput("Generated 2 patch(es) successfully");
  });

  it("should show dry-run output without making changes", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");
    const patchesDir = assertDefined(
      ctx.absolutePatchesDir,
      "absolutePatchesDir",
    );

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");
    await writeFileIn(repoDir, "newfile.txt", "new file content\n");

    const result = await runCli(`patchy generate --dry-run`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput(
      "[DRY RUN] Would generate patches from upstream to patches",
    );
    expect(result).toHaveOutput("Found 2 change(s):");
    expect(result).toHaveOutput("diff: initial.txt");
    expect(result).toHaveOutput("copy: newfile.txt");

    expect(path.join(patchesDir, "initial.txt.diff")).not.toExist();
    expect(path.join(patchesDir, "newfile.txt")).not.toExist();
  });

  it("should report no changes when repository is clean", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");

    await initGitRepoWithCommit(repoDir);

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("No changes detected in repository");
  });

  it("should fail when required fields are missing", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
      },
      jsonConfig: {
        verbose: true,
      },
    });

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository directory: set repo_dir in ./patchy.json, PATCHY_REPO_DIR env var, or --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init"
    `);
  });

  it("should fail when repo_dir does not exist", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "non-existent-repo",
        patches_dir: "patches",
      },
    });

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toFail();
    expect(result.stderr).toMatchInlineSnapshot(`
      "Validation errors:

      repo_dir: non-existent-repo in ./patchy.json does not exist: <TEST_DIR>/repos/non-existent-repo"
    `);
  });

  it("should create patches directory if it does not exist", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "new-patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Generated 1 patch(es) successfully");

    const patchesDir = path.join(tmpDir, "new-patches");
    expect(patchesDir).toExist();
    expect(path.join(patchesDir, "initial.txt.diff")).toExist();
  });

  it("should handle verbose flag", async () => {
    const ctx = await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_base_dir: "repos",
        repo_dir: "upstream",
        patches_dir: "patches",
      },
    });

    const repoDir = assertDefined(ctx.absoluteRepoDir, "absoluteRepoDir");

    await initGitRepoWithCommit(repoDir);
    await writeFileIn(repoDir, "initial.txt", "modified content\n");

    const result = await runCli(`patchy generate --verbose`, tmpDir);

    expect(result).toSucceed();
    expect(result).toHaveOutput("Generating patches from upstream to patches");
    expect(result).toHaveOutput("Created diff: initial.txt.diff");
  });
});
