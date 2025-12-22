import type { LocalContext } from "~/context";

export const exit = (
  context: LocalContext,
  {
    exitCode,
    stderr,
  }: {
    exitCode: number;
    stderr?: string;
  },
): never => {
  if (stderr) {
    context.process.stderr.write(
      stderr.endsWith("\n") ? stderr : `${stderr}\n`,
    );
  }

  context.process.exit(exitCode);
  throw new Error("fin");
};
