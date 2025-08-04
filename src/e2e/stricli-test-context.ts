import { resolve } from "node:path";
import type { LocalContext } from "../context";

export class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`Process exited with code ${code}`);
    this.name = "ProcessExitError";
  }
}

// Test context pattern from Stricli docs: https://bloomberg.github.io/stricli/docs/features/isolated-context
interface TestWritable {
  readonly lines: string[];
  write(chunk: string): void;
  getColorDepth?(env?: Readonly<Partial<Record<string, string>>>): number;
}

interface TestProcess {
  readonly stdout: TestWritable;
  readonly stderr: TestWritable;
  readonly env?: Readonly<Partial<Record<string, string>>>;
  exitCode?: number | string;
  exit(code?: number): never;
  cwd(): string;
  chdir(dir: string): void;
}

export interface TestContext extends LocalContext {
  readonly process: TestProcess & NodeJS.Process;
  readonly exitCode: number | undefined;
  readonly stdout: string[];
  readonly stderr: string[];
  readonly cleanup: () => void;
}

export const buildTestContext = (options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  colorDepth?: number;
}): TestContext => {
  let currentCwd = options?.cwd ?? process.cwd();
  const env = options?.env ?? {};
  const colorDepth = options?.colorDepth ?? 4;

  const stdout: string[] = [];
  const stderr: string[] = [];

  const createWritable = (output: string[]): TestWritable => ({
    lines: output,
    write(chunk: string) {
      // Filter out error stack traces that start with ANSI color codes
      if (
        !chunk.includes("\x1b[31mCommand failed") &&
        !chunk.includes("[31mCommand failed")
      ) {
        output.push(chunk);
      }
    },
    getColorDepth() {
      return colorDepth;
    },
  });

  // Store original process methods we need to preserve
  const originalChdir = process.chdir;
  const originalCwd = process.cwd;

  let exitCode = 0;
  const testProcess = {
    ...process,
    stdout: createWritable(stdout),
    stderr: createWritable(stderr),
    env: { ...process.env, ...env },
    exit(code?: number): never {
      exitCode = code ?? 0;
      throw new ProcessExitError(exitCode);
    },
    cwd: () => currentCwd,
    chdir: (dir: string) => {
      // Update our tracked cwd but don't actually change process.cwd
      currentCwd = resolve(currentCwd, dir);
    },
  } as TestProcess & NodeJS.Process;

  // Temporarily override global process methods during test execution
  const cleanup = () => {
    process.chdir = originalChdir;
    process.cwd = originalCwd;
  };

  // Override global process methods to use our test values
  process.cwd = () => currentCwd;
  process.chdir = (dir: string) => {
    currentCwd = resolve(currentCwd, dir);
  };

  return {
    process: testProcess,
    get exitCode() {
      return exitCode;
    },
    stdout,
    stderr,
    cleanup,
  };
};

export const getTestOutput = (context: TestContext) => ({
  stdout: context.stdout.join("").trim(),
  stderr: context.stderr.join("").trim(),
  exitCode: context.exitCode ?? 0,
});
