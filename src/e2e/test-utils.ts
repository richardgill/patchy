import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Result } from "execa";
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
  // Run the built CLI file directly using Node.js spawn
  const cliPath = join(process.cwd(), "dist/cli.js");
  const args = parseShell(command) as string[];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn("node", [cliPath, ...args], {
      cwd,
      env: process.env,
      timeout: 10000,
    });

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code, signal) => {
      const exitCode = code ?? 1;

      // Return a result object that matches the execa Result type
      const result = {
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode,
        failed: exitCode !== 0,
        signal,
        cwd,
        reject: false,
        // Add minimal required properties for Result type
        all: undefined,
        stdio: [undefined, stdout, stderr] as const,
        ipcOutput: [],
        pipedFrom: [],
        command: command,
        escapedCommand: command,
        timedOut: false,
        killed: false,
        exited: true,
        signalDescription: undefined,
      } as unknown as PatchyResult;

      resolve(result);
    });

    child.on("error", (error) => {
      const result = {
        stdout: stdout.trimEnd(),
        stderr: (stderr + error.message).trimEnd(),
        exitCode: 1,
        failed: true,
        signal: undefined,
        cwd,
        reject: false,
        // Add minimal required properties for Result type
        all: undefined,
        stdio: [undefined, stdout, stderr] as const,
        ipcOutput: [],
        pipedFrom: [],
        command: command,
        escapedCommand: command,
        timedOut: false,
        killed: false,
        exited: true,
        signalDescription: undefined,
      } as unknown as PatchyResult;

      resolve(result);
    });
  });
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

export const assertFailedCommand = async (command: string, cwd: string) => {
  const result = await runPatchy(command, cwd);
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
  jsonConfig = {},
}: {
  tmpDir: string;
  createDirectories?: {
    patchesDir?: string | undefined;
    repoBaseDir?: string | undefined;
    repoDir?: string | undefined;
  };
  jsonConfig?: Record<string, string | boolean | number>;
}): Promise<TestContext> => {
  const ctx = await createTestDirStructure(tmpDir, createDirectories);

  const configPath = resolve(tmpDir, "patchy.json");
  await writeTestConfig(configPath, jsonConfig);

  return ctx;
};
