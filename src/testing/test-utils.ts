import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "@stricli/core";
import { app } from "~/app";
import type { LocalContext } from "~/context";

export type CLIResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  command: string;
  cwd: string;
};

// This helper can run cli commands in-process which is much faster than spinning up a new runtime for each test
export const runCli = async (
  command: string,
  cwd: string,
): Promise<CLIResult> => {
  // Drop "patchy" prefix if present, e.g., "patchy init" becomes "init"
  const processedCommand = command.replace(/^patchy\s+/, "");
  const args = processedCommand.split(/\s+/).filter(Boolean);

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  const mockProcess = {
    stdout: {
      write: (s: string) => {
        stdout += s;
      },
    },
    stderr: {
      write: (s: string) => {
        stderr += s;
      },
    },
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    exit: (code: number) => {
      exitCode = code;
    },
    cwd: () => cwd,
  };

  const context: LocalContext = {
    process: mockProcess as unknown as NodeJS.Process,
    cwd,
  };

  try {
    await run(app, args, context);
  } catch {
    if (exitCode === 0) {
      exitCode = 1;
    }
  }

  // Stabilize output by replacing temp dir paths with <TEST_DIR> for snapshot consistency
  return {
    stdout: stabilizeTempDir(stdout.trim()) ?? "",
    stderr: stabilizeTempDir(stderr.trim()) ?? "",
    exitCode,
    failed: exitCode !== 0,
    command,
    cwd,
  };
};

export const writeTestConfig = async (
  configPath: string,
  config: Record<string, string | boolean | number>,
) => {
  const jsonContent = JSON.stringify(config, null, 2);
  await writeFile(configPath, jsonContent);
};

export const generateTmpDir = (): string => {
  const testId = randomUUID();
  return join(process.cwd(), "e2e/tmp", `test-${testId}`);
};

// Replace paths up to and including tmp/test-UUID directory with <TEST_DIR>
// e.g. "/home/user/project/e2e/tmp/test-abc123/repos" → "<TEST_DIR>/repos"
export const stabilizeTempDir = (
  str: string | undefined,
): string | undefined => {
  if (!str) return str;
  return str.replace(/\/[^\s]*\/(?:e2e\/)?tmp\/test-[a-f0-9-]+/g, "<TEST_DIR>");
};

// biome-ignore lint/suspicious/noExplicitAny: Generic utility function needs to accept any JSON-serializable value
export const getStabilizedJson = (value: any): string | undefined => {
  return stabilizeTempDir(JSON.stringify(value, null, 2));
};

type TestDirContext = {
  testDir: string;
  originalCwd: string;
  absolutePatchesDir: string | undefined;
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
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
