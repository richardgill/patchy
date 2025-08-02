import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execa, type Result } from "execa";

import { parse as parseShell } from "shell-quote";
import { expect } from "vitest";

type TestContext = {
  testDir: string;
  originalCwd: string;
  absolutePatchesDir: string | undefined;
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
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

export const stabilizeTempDir = (
  output: string | undefined,
): string | undefined => {
  if (!output) return output;
  // Replace paths up to and including tmp/test-UUID directory with <TEST_DIR>
  return output.replace(
    /\/[^\s]*\/(?:e2e\/)?tmp\/test-[a-f0-9-]+/g,
    "<TEST_DIR>",
  );
};

// biome-ignore lint/suspicious/noExplicitAny: Generic utility function needs to accept any JSON-serializable value
export const getStabilizedJson = (value: any): string | undefined => {
  return stabilizeTempDir(JSON.stringify(value, null, 2));
};

export const generateTmpDir = (): string => {
  const testId = randomUUID();
  return join(process.cwd(), "e2e/tmp", `test-${testId}`);
};

const createTestDirStructure = async (
  tmpDir: string,
  directories: {
    patchesDir?: string | undefined;
    repoBaseDir?: string | undefined;
    repoDir?: string | undefined;
  },
): Promise<TestContext> => {
  const originalCwd = process.cwd();
  await mkdir(tmpDir, { recursive: true });

  let absolutePatchesDir: string | undefined;
  if (directories.patchesDir) {
    absolutePatchesDir = join(tmpDir, directories.patchesDir);
    await mkdir(absolutePatchesDir, { recursive: true });
  }
  let absoluteRepoBaseDir: string | undefined;
  if (directories.repoBaseDir) {
    absoluteRepoBaseDir = resolve(tmpDir, directories.repoBaseDir);
    await mkdir(absoluteRepoBaseDir, { recursive: true });
  }
  let absoluteRepoDir: string | undefined;
  if (directories.repoDir && absoluteRepoBaseDir) {
    absoluteRepoDir = join(absoluteRepoBaseDir, directories.repoDir);
    await mkdir(absoluteRepoDir, { recursive: true });
  }

  return {
    testDir: tmpDir,
    originalCwd,
    absolutePatchesDir,
    absoluteRepoBaseDir,
    absoluteRepoDir,
  };
};

export const setupTestWithConfig = async ({
  tmpDir,
  createDirectories = {},
  yamlConfig = {},
}: {
  tmpDir: string;
  createDirectories?: {
    patchesDir?: string | undefined;
    repoBaseDir?: string | undefined;
    repoDir?: string | undefined;
  };
  yamlConfig?: Record<string, string | boolean | number>;
}): Promise<TestContext> => {
  const ctx = await createTestDirStructure(tmpDir, createDirectories);

  const configPath = resolve(tmpDir, "patchy.yaml");
  await writeTestConfig(configPath, yamlConfig);

  return ctx;
};
