import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import yaml from "yaml";
import {
  cleanupTestDir,
  createTestDir,
  runPatchy,
  type TestContext,
} from "./test-utils";

describe("patchy init", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(ctx);
  });

  it("should initialize patchy with all flags", async () => {
    const configPath = join(ctx.testDir, "patchy.yaml");
    const patchesDir = join(ctx.testDir, "patches");
    const reposDir = join(ctx.testDir, "repos");
    const repoDir = join(reposDir, "upstream");

    const result = await runPatchy(
      `init --repoUrl https://github.com/example/upstream.git --repoDir ${repoDir} --repoBaseDir ${reposDir} --patchesDir ${patchesDir} --ref main --config ${configPath} --force`,
    );

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
