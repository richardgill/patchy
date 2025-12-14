import type { Readable, Writable } from "node:stream";
import type { CommandContext } from "@stricli/core";
import type {
  PromptHandler,
  RecordedPrompt,
} from "~/testing/prompt-testing-types";

export type LocalContext = CommandContext & {
  readonly process: NodeJS.Process;
  // used for testing
  readonly cwd: string;
  readonly promptInput?: Readable;
  readonly promptOutput?: Writable;
  readonly promptHandler?: PromptHandler;
  readonly onPromptRecord?: (prompt: RecordedPrompt) => void;
};

export const buildContext = (
  proc: NodeJS.Process,
  cwd?: string,
): LocalContext => ({
  process: proc,
  cwd: cwd ?? proc.cwd(),
  promptInput: proc.stdin,
  promptOutput: proc.stdout,
});
