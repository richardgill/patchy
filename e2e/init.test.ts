import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    const result = await runPatchy(
      `init --repoUrl https://github.com/example/test-repo.git --repoDir main --repoBaseDir ${join(ctx.testDir, "repos")} --patchesDir patches --ref main --config patchy.yaml --force`,
      ctx.testDir
    );

    expect(result.exitCode).toBe(0);
    
    const configPath = join(ctx.testDir, "patchy.yaml");
    expect(existsSync(configPath)).toBe(true);
    
    const yamlContent = readFileSync(configPath, "utf-8");
    const expectedYaml = `repo_url: https://github.com/example/test-repo.git
repo_dir: main
repo_base_dir: ${join(ctx.testDir, "repos")}
patches_dir: patches
ref: main
`;
    expect(yamlContent).toBe(expectedYaml);
    
    expect(existsSync(join(ctx.testDir, "patches"))).toBe(true);
  });
});
