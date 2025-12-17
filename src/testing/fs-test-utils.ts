import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

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
