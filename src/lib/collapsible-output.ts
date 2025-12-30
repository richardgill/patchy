import { spinner as clackSpinner } from "@clack/prompts";
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
  let spinnerInstance: ReturnType<typeof clackSpinner> | null = null;

  if (isTTY) {
    // Use styleFrame to indent the spinner character itself
    const indent = prefix.replace(/[├└│]/g, " ");
    spinnerInstance = clackSpinner({
      styleFrame: (frame) => `${indent}${frame}`,
    });
    spinnerInstance.start(label);
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
      if (spinnerInstance) {
        spinnerInstance.stop();
      }
      stream.write(`${prefix}${message ?? label} ${CHECK_MARK}\n`);
    },

    fail(message?: string) {
      if (spinnerInstance) {
        spinnerInstance.stop();
      }
      // Print buffered output on failure for debugging
      for (const line of outputBuffer) {
        stream.write(`${line}\n`);
      }
      stream.write(`${prefix}${message ?? label} ${CROSS_MARK}\n`);
    },
  };
};
