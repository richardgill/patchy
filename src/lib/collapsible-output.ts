import yoctoSpinner, { type Spinner } from "yocto-spinner";
import {
  ANSI_CLEAR_LINE,
  ANSI_MOVE_UP,
  CHECK_MARK,
  CROSS_MARK,
} from "./symbols";

type CollapsibleWriter = {
  /** Write output (shown live in TTY, collapsed on success) */
  write: (text: string) => void;
  /** Complete successfully - clears output in TTY, shows success symbol */
  succeed: (message?: string) => void;
  /** Complete with failure - preserves output for debugging */
  fail: (message?: string) => void;
};

type CollapsibleOptions = {
  stream: NodeJS.WriteStream;
  label: string;
  prefix?: string;
  indentOutput?: string;
};

export function createCollapsibleWriter(
  opts: CollapsibleOptions,
): CollapsibleWriter {
  const { stream, label, prefix = "", indentOutput = "    " } = opts;
  const isTTY = stream.isTTY ?? false;

  let linesWritten = 0;
  let spinner: Spinner | null = null;

  if (isTTY) {
    spinner = yoctoSpinner({ text: label, stream }).start();
  } else {
    stream.write(`${prefix}${label}\n`);
  }

  const clearOutputLines = () => {
    if (isTTY && linesWritten > 0) {
      for (let i = 0; i < linesWritten; i++) {
        stream.write(`${ANSI_MOVE_UP}${ANSI_CLEAR_LINE}`);
      }
      linesWritten = 0;
    }
  };

  return {
    write(text: string) {
      const lines = text.split("\n").filter(Boolean);

      if (isTTY && spinner) {
        spinner.stop();
        for (const line of lines) {
          stream.write(`${indentOutput}${line}\n`);
          linesWritten++;
        }
        spinner.start();
      } else {
        for (const line of lines) {
          stream.write(`${indentOutput}${line}\n`);
        }
      }
    },

    succeed(message?: string) {
      clearOutputLines();
      if (spinner) {
        spinner.success(message ?? label);
      } else {
        stream.write(`${prefix}${message ?? label} ${CHECK_MARK}\n`);
      }
    },

    fail(message?: string) {
      // Don't clear output - preserve for debugging
      if (spinner) {
        spinner.error(message ?? label);
      } else {
        stream.write(`${prefix}${message ?? label} ${CROSS_MARK}\n`);
      }
    },
  };
}
