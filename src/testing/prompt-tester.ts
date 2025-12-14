import { Readable, Writable } from "node:stream";

type QueuedEvent = {
  value: string;
  key: { name: string };
};

class MockReadable extends Readable {
  protected _buffer: unknown[] | null = [];
  public isTTY = true;

  _read() {
    if (this._buffer === null) {
      this.push(null);
      return;
    }
    for (const val of this._buffer) {
      this.push(val);
    }
    this._buffer = [];
  }

  pushValue(val: unknown): void {
    this._buffer?.push(val);
  }

  close(): void {
    this._buffer = null;
  }

  setRawMode(_mode: boolean): this {
    return this;
  }
}

class MockWritable extends Writable {
  public buffer: string[] = [];
  public isTTY = false;
  public columns = 80;
  public rows = 20;
  public onWrite?: () => void;

  _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.buffer.push(String(chunk));
    this.onWrite?.();
    callback();
  }
}

type PromptTester = {
  input: MockReadable;
  output: MockWritable;
  type: (text: string) => void;
  press: (
    key:
      | "return"
      | "escape"
      | "up"
      | "down"
      | "left"
      | "right"
      | "space"
      | "backspace",
  ) => void;
  getOutput: () => string;
};

export const createPromptTester = (): PromptTester => {
  const input = new MockReadable();
  const output = new MockWritable();

  const eventQueue: QueuedEvent[] = [];
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;
  let hasSeenOutput = false;

  const flushNextEvent = () => {
    if (eventQueue.length === 0) {
      flushing = false;
      return;
    }

    flushing = true;
    const event = eventQueue.shift();
    if (event) {
      input.emit("keypress", event.value, event.key);
    }

    // Small delay between keypresses to let prompt process each one
    setImmediate(flushNextEvent);
  };

  const scheduleFlush = () => {
    // Only flush after we've seen prompt output
    if (!hasSeenOutput) {
      return;
    }

    if (flushTimeout) {
      clearTimeout(flushTimeout);
    }
    // Wait a tick after output settles before sending input
    flushTimeout = setTimeout(() => {
      if (!flushing && eventQueue.length > 0) {
        flushNextEvent();
      }
    }, 0);
  };

  // Watch for prompt output and flush queued events
  output.onWrite = () => {
    hasSeenOutput = true;
    scheduleFlush();
  };

  const queueKeypress = (value: string, key: { name: string }) => {
    eventQueue.push({ value, key });
  };

  return {
    input,
    output,

    type: (text: string) => {
      for (const char of text) {
        queueKeypress(char, { name: char });
      }
    },

    press: (key) => {
      const keyValue = key === "return" ? "" : key;
      queueKeypress(keyValue, { name: key });
    },

    getOutput: () => output.buffer.join(""),
  };
};
