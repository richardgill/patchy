import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "zx";

$.verbose = false;
$.shell = "/bin/bash";

export type TestContext = {
  testDir: string;
  originalCwd: string;
};

export const createTestDir = async (): Promise<TestContext> => {
  const originalCwd = process.cwd();
  const testId = randomUUID();
  const testDir = join(originalCwd, "e2e/tmp", `test-${testId}`);
  await mkdir(testDir, { recursive: true });

  return { testDir, originalCwd };
};

export const cleanupTestDir = async (ctx: TestContext) => {
  process.chdir(ctx.originalCwd);
  await rm(ctx.testDir, { recursive: true, force: true });
};

export const runPatchy = async (command: string) => {
  return await $`pnpm run dev ${command.split(" ")}`;
};
