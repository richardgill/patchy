import ora, { type Ora } from "ora";
import { CHECK_MARK, CROSS_MARK } from "./symbols";

type CollapsibleWriter = {
  write: (text: string) => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
};

type CollapsibleOptions = {
  stream: NodeJS.WriteStream;
  label: string;
  prefix?: string;
  indentOutput?: string;
  verbose?: boolean;
};

export const createCollapsibleWriter = (
  opts: CollapsibleOptions,
): CollapsibleWriter => {
  const {
    stream,
    label,
    prefix = "",
    indentOutput = "    ",
    verbose = false,
  } = opts;
  const isTTY = stream.isTTY ?? false;

  const outputBuffer: string[] = [];
  let spinner: Ora | null = null;

  if (isTTY) {
    // Count leading spaces in prefix for indent
    const indentSpaces = prefix.match(/^(\s*)/)?.[1]?.length ?? 0;
    spinner = ora({ text: label, stream, indent: indentSpaces }).start();
  } else {
    stream.write(`${prefix}${label}\n`);
  }

  return {
    write(text: string) {
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        outputBuffer.push(`${indentOutput}${line}`);
      }

      if (verbose && !isTTY) {
        for (const line of lines) {
          stream.write(`${indentOutput}${line}\n`);
        }
      }
    },

    succeed(message?: string) {
      if (spinner) {
        spinner.stop();
        // ora's indent option leaves cursor at indent position after stop
        stream.cursorTo?.(0);
      }
      stream.write(`${prefix}${message ?? label} ${CHECK_MARK}\n`);
    },

    fail(message?: string) {
      if (spinner) {
        spinner.stop();
        // ora's indent option leaves cursor at indent position after stop
        stream.cursorTo?.(0);
      }
      // Print buffered output on failure for debugging
      for (const line of outputBuffer) {
        stream.write(`${line}\n`);
      }
      stream.write(`${prefix}${message ?? label} ${CROSS_MARK}\n`);
    },
  };
};
