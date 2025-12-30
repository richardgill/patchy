import { describe, expect, it } from "bun:test";
import { createCollapsibleWriter } from "./collapsible-output";
import { CHECK_MARK, CROSS_MARK } from "./symbols";

const createMockStream = (isTTY = false) => {
  const output: string[] = [];
  return {
    stream: {
      isTTY,
      write: (text: string) => {
        output.push(text);
        return true;
      },
      cursorTo: () => true,
    } as unknown as NodeJS.WriteStream,
    output,
  };
};

describe("createCollapsibleWriter (non-TTY)", () => {
  it("writes label immediately on creation", () => {
    const { stream, output } = createMockStream();
    createCollapsibleWriter({ stream, label: "Running task" });
    expect(output).toEqual(["Running task\n"]);
  });

  it("writes prefix + label on creation", () => {
    const { stream, output } = createMockStream();
    createCollapsibleWriter({ stream, label: "Running task", prefix: "  ├ " });
    expect(output).toEqual(["  ├ Running task\n"]);
  });

  it("buffers write() calls without outputting in non-verbose mode", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({ stream, label: "Task" });
    output.length = 0;

    writer.write("line 1\nline 2");
    expect(output).toEqual([]);
  });

  it("outputs write() calls immediately in verbose mode", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      verbose: true,
    });
    output.length = 0;

    writer.write("line 1\nline 2");
    expect(output).toEqual(["    line 1\n", "    line 2\n"]);
  });

  it("uses custom indentOutput for verbose mode", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      verbose: true,
      indentOutput: ">> ",
    });
    output.length = 0;

    writer.write("hello");
    expect(output).toEqual([">> hello\n"]);
  });

  it("succeed() writes label with check mark", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({ stream, label: "Task" });
    output.length = 0;

    writer.succeed();
    expect(output).toEqual([`Task ${CHECK_MARK}\n`]);
  });

  it("succeed() uses custom message when provided", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({ stream, label: "Task" });
    output.length = 0;

    writer.succeed("Custom success");
    expect(output).toEqual([`Custom success ${CHECK_MARK}\n`]);
  });

  it("succeed() includes prefix", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      prefix: "  └ ",
    });
    output.length = 0;

    writer.succeed();
    expect(output).toEqual([`  └ Task ${CHECK_MARK}\n`]);
  });

  it("fail() outputs buffered content then failure message", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      indentOutput: "  ",
    });
    output.length = 0;

    writer.write("error line 1\nerror line 2");
    writer.fail();

    expect(output).toEqual([
      "  error line 1\n",
      "  error line 2\n",
      `Task ${CROSS_MARK}\n`,
    ]);
  });

  it("fail() uses custom message when provided", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({ stream, label: "Task" });
    output.length = 0;

    writer.fail("Custom failure");
    expect(output).toEqual([`Custom failure ${CROSS_MARK}\n`]);
  });

  it("fail() includes prefix", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      prefix: "  ├ ",
    });
    output.length = 0;

    writer.fail();
    expect(output).toEqual([`  ├ Task ${CROSS_MARK}\n`]);
  });

  it("filters empty lines from write() input", () => {
    const { stream, output } = createMockStream();
    const writer = createCollapsibleWriter({
      stream,
      label: "Task",
      verbose: true,
    });
    output.length = 0;

    writer.write("\n\nline 1\n\nline 2\n\n");
    expect(output).toEqual(["    line 1\n", "    line 2\n"]);
  });
});
