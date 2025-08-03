import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertFailedCommand,
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

    const result = await assertFailedCommand(`apply --dry-run`, tmpDir);

    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json or use --repo-base-dir flag
        Missing Repository directory: set repo_dir in ./patchy.json or use --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init
      "
    `);
  });

  it("should fail when config file doesn't exist with explicit path", async () => {
    mkdirSync(tmpDir, { recursive: true });

    const result = await assertFailedCommand(
      `apply --config ./non-existent-config.json`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Configuration file not found: <TEST_DIR>/non-existent-config.json"
    `);
  });

  it("should fail on invalid JSON syntax", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const invalidJsonPath = path.join(tmpDir, "invalid.json");
    writeFileSync(invalidJsonPath, "{ invalid json: content }");

    const result = await assertFailedCommand(
      `apply --config invalid.json`,
      tmpDir,
    );

    expect(result.stderr).toMatchInlineSnapshot(`
      "JSON parse error: InvalidSymbol at offset 2"
    `);
  });

  it("should fail validation when directories don't exist", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "non-existent-base",
        repo_dir: "non-existent-repo",
        patches_dir: "non-existent-patches",
      },
    });

    const result = await assertFailedCommand(`apply`, tmpDir);

    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Validation errors:

      repo_base_dir: non-existent-base in ./patchy.json does not exist: <TEST_DIR>/non-existent-base
      patches_dir: non-existent-patches in ./patchy.json does not exist: <TEST_DIR>/non-existent-patches
      "
    `);
  });

  it("should succeed even with invalid repo URL since it's not required for apply", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "invalid-url-format",
        repo_base_dir: "base",
        repo_dir: "repo",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: invalid-url-format
        repo_dir: repo
        repo_base_dir: base
        patches_dir: ./patches/
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repo"
    `);
  });

  it("should handle empty JSON config file with CLI flags", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "empty.json");
    writeFileSync(emptyJsonPath, "{}");

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {},
    });

    const result = await assertSuccessfulCommand(
      `apply --config empty.json --repo-url https://github.com/example/repo.git --repo-base-dir base --repo-dir repo --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: repo
        repo_base_dir: base
        patches_dir: ./patches/
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repo"
    `);
  });

  it("should handle boolean flags correctly", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        verbose: false,
        dry_run: false,
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --verbose --dry-run`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: repo
        repo_base_dir: base
        patches_dir: ./patches/
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repo"
    `);
  });

  it("should use custom config path", async () => {
    const customConfigDir = path.join(tmpDir, "custom");
    const customConfigPath = path.join(customConfigDir, "config.json");
    mkdirSync(customConfigDir, { recursive: true });

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/custom.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        ref: "custom-branch",
      },
    });

    writeFileSync(
      customConfigPath,
      JSON.stringify(
        {
          repo_url: "https://github.com/example/custom.git",
          repo_base_dir: "base",
          repo_dir: "repo",
          ref: "custom-branch",
        },
        null,
        2,
      ),
    );

    const result = await assertSuccessfulCommand(
      `apply --config ${customConfigPath} --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/custom.git
        repo_dir: repo
        repo_base_dir: base
        patches_dir: ./patches/
        ref: custom-branch
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repo"
    `);
  });

  it("should correctly join repo_base_dir and repo_dir paths", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "my-base/nested",
        repoDir: "my-repo/nested-repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "my-base/nested",
        repo_dir: "my-repo/nested-repo",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: my-repo/nested-repo
        repo_base_dir: my-base/nested
        patches_dir: ./patches/
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to my-repo/nested-repo"
    `);
  });

  it("should use default values when not specified", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "repoBaseDir1",
        repoDir: "repoDir1",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "repoBaseDir1",
        repo_dir: "repoDir1",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: repoDir1
        repo_base_dir: repoBaseDir1
        patches_dir: ./patches/
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repoDir1"
    `);
  });

  it("should handle different combinations of missing required fields", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {},
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
      },
    });

    const result = await assertFailedCommand(`apply`, tmpDir);
    expect(stabilizeTempDir(result.stderr)).toMatchInlineSnapshot(`
      "Missing required parameters:

        Missing Repository base directory: set repo_base_dir in ./patchy.json or use --repo-base-dir flag
        Missing Repository directory: set repo_dir in ./patchy.json or use --repo-dir flag

      You can set up ./patchy.json by running:
        patchy init
      "
    `);
  });

  it("should handle ref override from CLI", async () => {
    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "base",
        repoDir: "repo",
        patchesDir: "patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: "base",
        repo_dir: "repo",
        ref: "json-ref",
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --ref cli-ref --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: repo
        repo_base_dir: base
        patches_dir: ./patches/
        ref: cli-ref
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from ./patches/ to repo"
    `);
  });

  it("should handle absolute paths in config", async () => {
    const absoluteBase = path.join(tmpDir, "absolute-base");
    const absolutePatches = path.join(tmpDir, "absolute-patches");

    await setupTestWithConfig({
      tmpDir,
      createDirectories: {
        repoBaseDir: "absolute-base",
        repoDir: "repo",
        patchesDir: "absolute-patches",
      },
      jsonConfig: {
        repo_url: "https://github.com/example/repo.git",
        repo_base_dir: absoluteBase,
        repo_dir: "repo",
        patches_dir: absolutePatches,
      },
    });

    const result = await assertSuccessfulCommand(
      `apply --dry-run --verbose`,
      tmpDir,
    );

    expect(stabilizeTempDir(result.stdout)).toMatchInlineSnapshot(`
      "Configuration resolved:
        repo_url: https://github.com/example/repo.git
        repo_dir: repo
        repo_base_dir: <TEST_DIR>/absolute-base
        patches_dir: <TEST_DIR>/absolute-patches
        ref: main
        verbose: true
        dry_run: true
      [DRY RUN] Would apply patches from <TEST_DIR>/absolute-patches to repo"
    `);
  });

  it("should handle truly empty JSON file", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const emptyJsonPath = path.join(tmpDir, "truly-empty.json");
    writeFileSync(emptyJsonPath, "");

    const result = await assertFailedCommand(
      `apply --config truly-empty.json`,
      tmpDir,
    );

    expect(result.stderr).toMatchInlineSnapshot(`
      "JSON parse error: ValueExpected at offset 0"
    `);
  });

  it("should handle invalid JSON structure", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const invalidJsonPath = path.join(tmpDir, "invalid-structure.json");
    writeFileSync(
      invalidJsonPath,
      JSON.stringify({
        repo_url: 123,
        verbose: "not-a-boolean",
        ref: ["array", "not", "string"],
      }),
    );

    const result = await assertFailedCommand(
      `apply --config invalid-structure.json`,
      tmpDir,
    );
    expect(result.stderr).toContain("Invalid input");
  });
});
