import type { CommandContext } from "@stricli/core";

export type LocalContext = CommandContext & {
  readonly process: NodeJS.Process;
  readonly cwd: string;
};

export const buildContext = (
  proc: NodeJS.Process,
  cwd?: string,
): LocalContext => ({
  process: proc,
  cwd: cwd ?? proc.cwd(),
});
