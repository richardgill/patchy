import type { Readable, Writable } from "node:stream";
import type { CommandContext } from "@stricli/core";

export type LocalContext = CommandContext & {
  readonly process: NodeJS.Process;
  readonly cwd: string;
  readonly promptInput?: Readable;
  readonly promptOutput?: Writable;
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
