import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { run } from "@stricli/core";
import { app } from "~/app";
import type { LocalContext } from "~/context";
import type { CLIResult } from "./cli-types";
import {
  acceptDefault,
  cancel,
  createPromptBuilder,
  type PromptBuilder,
} from "./prompt-builder";

import type { PromptHandler, RecordedPrompt } from "./prompt-testing-types";

type PromptOptions = {
  promptInput?: Readable;
  promptOutput?: Writable;
  promptHandler?: PromptHandler;
  onPromptRecord?: (prompt: RecordedPrompt) => void;
};

export const runCli = async (
  command: string,
  cwd: string,
  options: PromptOptions = {},
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
    promptInput: options.promptInput,
    promptOutput: options.promptOutput,
    promptHandler: options.promptHandler,
    onPromptRecord: options.onPromptRecord,
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

// Write a file to a directory, creating any necessary parent directories.
// Supports nested paths like "config/settings.json".
export const writeTestFile = async (
  dir: string,
  filename: string,
  content: string,
): Promise<string> => {
  const fullPath = join(dir, filename);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
  return filename;
};

// Write JSON to a file, creating any necessary parent directories.
// Supports nested paths like "config/settings.json".
export const writeJsonConfig = async (
  dir: string,
  filename: string,
  // biome-ignore lint/suspicious/noExplicitAny: Test utility needs to accept invalid configs for error testing
  content: any,
): Promise<string> => {
  return writeTestFile(dir, filename, JSON.stringify(content, null, 2));
};

export const generateTmpDir = (): string => {
  const testId = randomUUID();
  return join(process.cwd(), "e2e/tmp", `test-${testId}`);
};

// Write a file to a base directory, creating nested subdirectories as needed.
export const writeFileIn = async (
  baseDir: string,
  relativePath: string,
  content: string,
): Promise<void> => {
  const fullPath = join(baseDir, relativePath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(fullPath, content);
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
  absoluteClonesDir: string | undefined;
  absoluteTargetRepo: string | undefined;
};

const createTestDirStructure = async (
  tmpDir: string,
  directories: {
    patchesDir?: string | undefined;
    clonesDir?: string | undefined;
    targetRepo?: string | undefined;
  },
): Promise<TestDirContext> => {
  const originalCwd = process.cwd();
  await mkdir(tmpDir, { recursive: true });

  let absolutePatchesDir: string | undefined;
  if (directories.patchesDir) {
    absolutePatchesDir = join(tmpDir, directories.patchesDir);
    await mkdir(absolutePatchesDir, { recursive: true });
  }
  let absoluteClonesDir: string | undefined;
  if (directories.clonesDir) {
    absoluteClonesDir = resolve(tmpDir, directories.clonesDir);
    await mkdir(absoluteClonesDir, { recursive: true });
  }
  let absoluteTargetRepo: string | undefined;
  if (directories.targetRepo && absoluteClonesDir) {
    absoluteTargetRepo = join(absoluteClonesDir, directories.targetRepo);
    await mkdir(absoluteTargetRepo, { recursive: true });
  }

  return {
    testDir: tmpDir,
    originalCwd,
    absolutePatchesDir,
    absoluteClonesDir,
    absoluteTargetRepo,
  };
};

export const setupTestWithConfig = async ({
  tmpDir,
  createDirectories = {},
  jsonConfig = {},
  configPath,
}: {
  tmpDir: string;
  createDirectories?: {
    patchesDir?: string | undefined;
    clonesDir?: string | undefined;
    targetRepo?: string | undefined;
  };
  jsonConfig?: Record<string, string | boolean | number>;
  configPath?: string;
}): Promise<TestDirContext> => {
  const ctx = await createTestDirStructure(tmpDir, createDirectories);

  const resolvedConfigPath = configPath ?? resolve(tmpDir, "patchy.json");
  await mkdir(dirname(resolvedConfigPath), { recursive: true });
  await writeTestConfig(resolvedConfigPath, jsonConfig);

  return ctx;
};

export const runCliWithPrompts = (
  command: string,
  cwd: string,
): PromptBuilder => {
  return createPromptBuilder(async (handler, onRecord) => {
    return runCli(command, cwd, {
      promptHandler: handler,
      onPromptRecord: onRecord,
    });
  });
};

export { acceptDefault, cancel };
