import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "@stricli/core";

import { parse as parseShell } from "shell-quote";
import { expect } from "vitest";
import { app } from "../app";
import {
  buildTestContext,
  getTestOutput,
  ProcessExitError,
} from "./stricli-test-context";

type TestDirContext = {
  testDir: string;
  originalCwd: string;
  absolutePatchesDir: string | undefined;
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
};

type CLIResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  command: string;
  cwd: string;
  signal?: NodeJS.Signals;
};

export const runCli = async (
  command: string,
  cwd: string,
): Promise<CLIResult> => {
  // Drop everything before the first space if there is one
  // e.g., "patchy init" becomes "init"
  const processedCommand = command.replace(/^\S+\s+/, "");

  const args = parseShell(processedCommand) as string[];

  const testContext = buildTestContext({ cwd });

  try {
    await run(app, args, testContext);
  } catch (error) {
    // In tests, process.exit() throws ProcessExitError - this is expected behavior.
    // Any OTHER error is an unexpected failure from the command (e.g., git operation failed).
    // We handle unexpected errors here so commands don't need try/catch boilerplate
    // just to re-throw ProcessExitError.
    if (!(error instanceof ProcessExitError)) {
      const message = error instanceof Error ? error.message : String(error);
      testContext.process.stderr.write(`Error: ${message}\n`);
      testContext.process.exit(1);
    }
  } finally {
    // Restore original process methods
    testContext.cleanup();
  }

  const output = getTestOutput(testContext);

  return {
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exitCode,
    failed: output.exitCode !== 0,
    command,
    cwd,
  };
};

export const assertSuccessfulCommand = async (
  command: string,
  cwd: string,
  validateFn?: (result: CLIResult) => void,
) => {
  const result = await runCli(command, cwd);
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

export const assertFailedCommand = async (command: string, cwd: string) => {
  const result = await runCli(command, cwd);
  expect(result.exitCode).toBe(1);
  return result;
};

export const writeTestConfig = async (
  configPath: string,
  config: Record<string, string | boolean | number>,
) => {
  const jsonContent = JSON.stringify(config, null, 2);
  await writeFile(configPath, jsonContent);
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
): Promise<TestDirContext> => {
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
  jsonConfig = {},
}: {
  tmpDir: string;
  createDirectories?: {
    patchesDir?: string | undefined;
    repoBaseDir?: string | undefined;
    repoDir?: string | undefined;
  };
  jsonConfig?: Record<string, string | boolean | number>;
}): Promise<TestDirContext> => {
  const ctx = await createTestDirStructure(tmpDir, createDirectories);

  const configPath = resolve(tmpDir, "patchy.json");
  await writeTestConfig(configPath, jsonConfig);

  return ctx;
};
