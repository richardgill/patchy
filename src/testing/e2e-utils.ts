import type { Readable, Writable } from "node:stream";
import { run } from "@stricli/core";
import { app } from "~/app";
import type { LocalContext } from "~/context";
import { stabilizeTempDir } from "./fs-test-utils";
import {
  acceptDefault,
  cancel,
  createPromptBuilder,
  type PromptBuilder,
} from "./prompt-builder";
import type { PromptHandler, RecordedPrompt } from "./prompt-testing-types";
import type { CLIResult } from "./testing-types";

type PromptOptions = {
  promptInput?: Readable;
  promptOutput?: Writable;
  promptHandler?: PromptHandler;
  onPromptRecord?: (prompt: RecordedPrompt) => void;
  env?: Record<string, string>;
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

  class MockProcessExit extends Error {
    constructor(public code: number) {
      super(`Process exited with code ${code}`);
      this.name = "MockProcessExit";
    }
  }

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
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...options.env },
    exitCode: 0 as number | undefined,
    exit: (code: number): never => {
      mockProcess.exitCode = code;
      throw new MockProcessExit(code);
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
  } catch (error) {
    if (error instanceof MockProcessExit) {
      // Expected exit - exitCode already set
    } else if (mockProcess.exitCode === 0) {
      mockProcess.exitCode = 1;
    }
  }

  // Clean up stderr: remove MockProcessExit error messages that stricli captures
  const cleanedStderr = stderr
    .replace(/\n?Error: MockProcessExit:[\s\S]*$/, "")
    .replace(/\nCommand failed, MockProcessExit:[\s\S]*$/, "")
    .replace(/^Command failed, MockProcessExit:[\s\S]*$/, "");

  const exitCode = mockProcess.exitCode ?? 0;

  // Stabilize output by replacing temp dir paths with <TEST_DIR> for snapshot consistency
  return {
    stdout: stabilizeTempDir(stdout.trim()) ?? "",
    stderr: stabilizeTempDir(cleanedStderr.trim()) ?? "",
    exitCode,
    failed: exitCode !== 0,
    command,
    cwd,
  };
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
