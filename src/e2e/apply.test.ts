import { beforeEach, describe, expect, it } from "vitest";
import {
  assertSuccessfulCommand,
  generateTmpDir,
  setupTestWithConfig,
  stabilizeTempDir,
} from "./test-utils";

describe("patchy apply", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = generateTmpDir();
  });

  it("should apply patches with all flags specified", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "patches",
        repoBaseDir: "repos",
        repoDir: "main",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "config-repo",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --repo-dir main --repo-base-dir repos --patches-dir patches --config patchy.json --verbose --dry-run`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/test-repo.git
        repo_dir: main
        repo_base_dir: repos
        patches_dir: patches
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from patches to main"
    `);
  });

  it("should apply patches using config file values", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "my-patches",
        repoBaseDir: "repos",
        repoDir: "upstream",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "upstream",
        repo_base_dir: `${tmpDir}/repos`,
        patches_dir: "my-patches",
        ref: "main",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/test-repo.git
        repo_dir: upstream
        repo_base_dir: <TEST_DIR>/repos
        patches_dir: my-patches
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from my-patches to upstream"
    `);
  });

  it("should override config file values with CLI flags", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        patchesDir: "cli-patches",
        repoBaseDir: "repos",
        repoDir: "cli-repo",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/test-repo.git",
        repo_dir: "config-repo",
        repo_base_dir: `${tmpDir}/repos`,
        patches_dir: "config-patches",
        ref: "main",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --repo-dir cli-repo --patches-dir cli-patches --config patchy.json --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/test-repo.git
        repo_dir: cli-repo
        repo_base_dir: <TEST_DIR>/repos
        patches_dir: cli-patches
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from cli-patches to cli-repo"
    `);
  });
});
