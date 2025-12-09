import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type TestDirContext = {
  testDir: string;
  originalCwd: string;
  absolutePatchesDir: string | undefined;
  absoluteRepoBaseDir: string | undefined;
  absoluteRepoDir: string | undefined;
};

export type CLIResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  command: string;
  cwd: string;
  signal?: NodeJS.Signals;
};

// Path to the CLI entry point
const CLI_PATH = resolve(import.meta.dirname, "../cli.ts");

export const runCli = async (
  command: string,
  cwd: string,
): Promise<CLIResult> => {
  // Drop "patchy" prefix if present, e.g., "patchy init" becomes "init"
  const processedCommand = command.replace(/^patchy\s+/, "");
  const args = processedCommand.split(/\s+/).filter(Boolean);

  const execArgs = ["run", CLI_PATH, ...args];

  const proc = Bun.spawn(["bun", ...execArgs], {
    cwd,
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    failed: exitCode !== 0,
    command,
    cwd,
    signal: proc.signalCode ?? undefined,
  };
};

export const writeTestConfig = async (
  configPath: string,
  config: Record<string, string | boolean | number>,
) => {
  const jsonContent = JSON.stringify(config, null, 2);
  await writeFile(configPath, jsonContent);
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
