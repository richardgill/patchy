import chalk from "chalk";
import * as JSONC from "jsonc-parser";

type ParseResult<T = unknown> =
  | { success: true; json: T }
  | { success: false; error: string };

const formatJsonErrorWithContext = (
  jsonString: string,
  errorLine: number,
  errorChar: number,
  errorMessage: string,
  contextLines = 2,
): string => {
  const lines = jsonString.split("\n");
  const startLine = Math.max(0, errorLine - contextLines);
  const endLine = Math.min(lines.length - 1, errorLine + contextLines);

  const errorOutput: string[] = [
    chalk.red.bold(`JSON parse error: ${errorMessage}`),
    "",
  ];

  for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
    const lineNum = `${currentLine + 1}`.padStart(4, " ");
    const isErrorLine = currentLine === errorLine;
    const prefix = isErrorLine ? chalk.red(">") : " ";

    errorOutput.push(
      `${prefix} ${chalk.gray(lineNum)} | ${lines[currentLine]}`,
    );

    if (isErrorLine && errorChar >= 0) {
      const pointer = " ".repeat(errorChar + 8) + chalk.red("^");
      errorOutput.push(pointer);
    }
  }

  return errorOutput.join("\n");
};

type ParseError = {
  message: string;
  line: number;
  character: number;
};

export const parseJsonc = <T = unknown>(jsonString: string): ParseResult<T> => {
  let parseError: ParseError | null = null;

  JSONC.visit(
    jsonString,
    {
      onError: (error, _offset, _length, startLine, startCharacter) => {
        if (!parseError) {
          parseError = {
            message: JSONC.printParseErrorCode(error),
            line: startLine,
            character: startCharacter,
          };
        }
      },
    },
    {
      disallowComments: false,
      allowTrailingComma: true,
    },
  );

  if (parseError) {
    const errorInfo = parseError as ParseError; // Explicit assignment to help TypeScript
    return {
      success: false,
      error: formatJsonErrorWithContext(
        jsonString,
        errorInfo.line,
        errorInfo.character,
        errorInfo.message,
      ),
    };
  }

  try {
    const json = JSONC.parse(jsonString, undefined, {
      disallowComments: false,
      allowTrailingComma: true,
    }) as T;
    return { success: true, json };
  } catch {
    return { success: false, error: "Failed to parse JSON" };
  }
};
