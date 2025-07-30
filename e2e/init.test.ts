import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { $ } from "zx";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import yaml from "yaml";

// Configure zx for better performance
$.verbose = false; // Reduce output noise
$.shell = "/bin/bash"; // Use bash directly

describe("patchy init", () => {
  let testDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    // Use unique directory per test to support concurrency
    const testId = randomUUID();
    testDir = join(originalCwd, "e2e/tmp", `init-test-${testId}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  it("should initialize patchy with all flags", async () => {
    const configPath = join(testDir, "patchy.yaml");
    const patchesDir = join(testDir, "patches");
    const reposDir = join(testDir, "repos");
    const repoDir = join(reposDir, "upstream");

    const result = await $`pnpm run dev init \
      --repoUrl https://github.com/example/upstream.git \
      --repoDir ${repoDir} \
      --repoBaseDir ${reposDir} \
      --patchesDir ${patchesDir} \
      --ref main \
      --config ${configPath} \
      --force`;

    expect(result.exitCode).toBe(0);

    expect(existsSync(configPath)).toBe(true);

    const configContent = readFileSync(configPath, "utf-8");
    const config = yaml.parse(configContent);

    expect(config.repo_url).toBe("https://github.com/example/upstream.git");
    expect(config.repo_dir).toBe(repoDir);
    expect(config.repo_base_dir).toBe(reposDir);
    expect(config.patches_dir).toBe(patchesDir);
    expect(config.ref).toBe("main");

    expect(existsSync(patchesDir)).toBe(true);
  });
});

