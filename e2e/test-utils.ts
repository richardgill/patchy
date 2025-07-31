import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";

export type TestContext = {
  testDir: string;
  originalCwd: string;
  patchesDir: string;
  repoBaseDir: string;
};

export const createTestDir = async (
  patchesSubdir = "patches",
  repoSubdir = "repos",
): Promise<TestContext> => {
  const originalCwd = process.cwd();
  const testId = randomUUID();
  const testDir = join(originalCwd, "e2e/tmp", `test-${testId}`);
  const patchesDir = join(testDir, patchesSubdir);
  const repoBaseDir = join(testDir, repoSubdir);

  await mkdir(testDir, { recursive: true });
  await mkdir(patchesDir, { recursive: true });
  await mkdir(repoBaseDir, { recursive: true });

  return { testDir, originalCwd, patchesDir, repoBaseDir };
};

export const cleanupTestDir = async (ctx: TestContext) => {
  process.chdir(ctx.originalCwd);
  await rm(ctx.testDir, { recursive: true, force: true });
};

export const runPatchy = async (command: string, cwd: string) => {
  const cliPath = join(process.cwd(), "src/cli.ts");
  const tsxPath = join(process.cwd(), "node_modules/.bin/tsx");

  // Parse command into arguments array
  const args = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  const result = await execa(tsxPath, [cliPath, ...args], {
    cwd,
    reject: false,
  });

  return result;
};
