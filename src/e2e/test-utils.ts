import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa, type Result } from "execa";

import { parse as parseShell } from "shell-quote";
import { expect } from "vitest";

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

type PatchyResult = Result<{ cwd: string; reject: false }>;

export const runPatchy = async (
  command: string,
  cwd: string,
): Promise<PatchyResult> => {
  const cliPath = join(process.cwd(), "src/cli.ts");
  const tsxPath = join(process.cwd(), "node_modules/.bin/tsx");

  const args = parseShell(command) as string[];

  const result = await execa(tsxPath, [cliPath, ...args], {
    cwd,
    reject: false,
  });
  return result;
};

export const assertSuccessfulCommand = async (
  command: string,
  cwd: string,
  validateFn?: (result: PatchyResult) => void,
) => {
  const result = await runPatchy(command, cwd);
  if (result.exitCode !== 0) {
    console.error(`Command failed: ${command}`);
    console.error(`Exit code: ${result.exitCode}`);
    console.error(`stderr: ${result.stderr}`);
    console.error(`stdout: ${result.stdout}`);
  }
  expect(result.exitCode).toBe(0);
  if (validateFn) validateFn(result);
  return result;
};

export const assertFailedCommand = async (
  command: string,
  cwd: string,
  expectedErrors: string | string[],
) => {
  const result = await runPatchy(command, cwd);
  expect(result.exitCode).toBe(1);
  const errors = Array.isArray(expectedErrors)
    ? expectedErrors
    : [expectedErrors];
  for (const error of errors) {
    expect(result.stderr).toContain(error);
  }
  return result;
};

export const writeTestConfig = async (
  configPath: string,
  config: Record<string, string | boolean | number>,
) => {
  const yamlContent = Object.entries(config)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  await writeFile(configPath, yamlContent);
};

export const assertConfigFileExists = (configPath: string) => {
  expect(existsSync(configPath)).toBe(true);
};

export const assertConfigContent = (
  configPath: string,
  expectedYaml: string,
) => {
  const yamlContent = readFileSync(configPath, "utf-8");
  expect(yamlContent.trim()).toBe(expectedYaml.trim());
};

export const stabilizeTempDir = (output: string): string => {
  // Replace paths up to and including tmp/test-UUID directory with <TEST_DIR>
  return output.replace(/[^\s]*\/tmp\/test-[a-f0-9-]+/g, "<TEST_DIR>");
};
