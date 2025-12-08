import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertFailedCommand,
  assertSuccessfulCommand,
  generateTmpDir,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

// Removes GIT_* env vars and disables LEFTHOOK to prevent interference during tests
const getCleanTestGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("GIT_") && key !== "LEFTHOOK",
    ),
  );

const testGitClient = (repoDir: string) =>
  simpleGit({
    baseDir: repoDir,
    binary: "git",
    maxConcurrentProcesses: 6,
  }).env({ ...getCleanTestGitEnv(), LEFTHOOK: "0" });

const initGitRepo = async (repoDir: string): Promise<void> => {
  const git = testGitClient(repoDir);

  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");

  writeFileSync(path.join(repoDir, "initial.txt"), "initial content\n");
  await git.add(".");
  await git.commit("initial commit");
};

const modifyFile = (
  repoDir: string,
  filePath: string,
  content: string,
): void => {
  const fullPath = path.join(repoDir, filePath);
  const dir = path.dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fullPath, content);
};

const assertDefined = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`Expected ${name} to be defined`);
  }
  return value;
};

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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "initial.txt", "modified content\n");

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain(
      "Generating patches from upstream to patches",
    );
    expect(result.stdout).toContain("Created diff: initial.txt.diff");
    expect(result.stdout).toContain("Generated 1 patch(es) successfully");

    const diffPath = path.join(patchesDir, "initial.txt.diff");
    expect(existsSync(diffPath)).toBe(true);

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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "newfile.txt", "new file content\n");

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain("Copied new file: newfile.txt");

    const newFilePath = path.join(patchesDir, "newfile.txt");
    expect(existsSync(newFilePath)).toBe(true);

    const content = readFileSync(newFilePath, "utf-8");
    expect(content).toBe("new file content\n");
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

    await initGitRepo(repoDir);
    modifyFile(
      repoDir,
      "src/components/Button.tsx",
      "export const Button = () => <button />\n",
    );

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain(
      "Copied new file: src/components/Button.tsx",
    );

    const newFilePath = path.join(patchesDir, "src/components/Button.tsx");
    expect(existsSync(newFilePath)).toBe(true);
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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "initial.txt", "modified content\n");
    modifyFile(repoDir, "newfile.txt", "new file content\n");

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain("Created diff: initial.txt.diff");
    expect(result.stdout).toContain("Copied new file: newfile.txt");
    expect(result.stdout).toContain("Generated 2 patch(es) successfully");
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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "initial.txt", "modified content\n");
    modifyFile(repoDir, "newfile.txt", "new file content\n");

    const result = await assertSuccessfulCommand(
      `patchy generate --dry-run`,
      tmpDir,
    );

    expect(result.stdout).toContain(
      "[DRY RUN] Would generate patches from upstream to patches",
    );
    expect(result.stdout).toContain("Found 2 change(s):");
    expect(result.stdout).toContain("diff: initial.txt");
    expect(result.stdout).toContain("copy: newfile.txt");

    expect(existsSync(path.join(patchesDir, "initial.txt.diff"))).toBe(false);
    expect(existsSync(path.join(patchesDir, "newfile.txt"))).toBe(false);
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

    await initGitRepo(repoDir);

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain("No changes detected in repository");
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

    const result = await assertFailedCommand(`patchy generate`, tmpDir);

    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json, PATCHY_REPO_BASE_DIR env var, or --repo-base-dir flag
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

    const result = await assertFailedCommand(`patchy generate`, tmpDir);

    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "initial.txt", "modified content\n");

    const result = await assertSuccessfulCommand(`patchy generate`, tmpDir);

    expect(result.stdout).toContain("Generated 1 patch(es) successfully");

    const patchesDir = path.join(tmpDir, "new-patches");
    expect(existsSync(patchesDir)).toBe(true);
    expect(existsSync(path.join(patchesDir, "initial.txt.diff"))).toBe(true);
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

    await initGitRepo(repoDir);
    modifyFile(repoDir, "initial.txt", "modified content\n");

    const result = await assertSuccessfulCommand(
      `patchy generate --verbose`,
      tmpDir,
    );

    expect(result.stdout).toContain("Configuration resolved:");
    expect(result.stdout).toContain("repo_base_dir: repos");
    expect(result.stdout).toContain("repo_dir: upstream");
  });
});
