import { expect } from "vitest";
import type { CLIResult } from "./test-utils";

export const cliMatchers = {
  toSucceed(received: CLIResult) {
    const pass = received.exitCode === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected command to fail but it succeeded\nCommand: ${received.command}\nstdout: ${received.stdout}`
          : `Expected command to succeed but it failed with exit code ${received.exitCode}\nCommand: ${received.command}\nstderr: ${received.stderr}\nstdout: ${received.stdout}`,
    };
  },

  toFail(received: CLIResult) {
    const pass = received.exitCode !== 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected command to succeed but it failed with exit code ${received.exitCode}\nCommand: ${received.command}\nstderr: ${received.stderr}`
          : `Expected command to fail but it succeeded\nCommand: ${received.command}\nstdout: ${received.stdout}`,
    };
  },

  toHaveOutput(received: CLIResult, expected: string | RegExp) {
    const matches =
      typeof expected === "string"
        ? received.stdout.includes(expected)
        : expected.test(received.stdout);

    return {
      pass: matches,
      message: () =>
        matches
          ? `Expected stdout NOT to contain ${expected}\nActual stdout: ${received.stdout}`
          : `Expected stdout to contain ${expected}\nActual stdout: ${received.stdout}`,
    };
  },

  toHaveError(received: CLIResult, expected: string | RegExp) {
    const matches =
      typeof expected === "string"
        ? received.stderr.includes(expected)
        : expected.test(received.stderr);

    return {
      pass: matches,
      message: () =>
        matches
          ? `Expected stderr NOT to contain ${expected}\nActual stderr: ${received.stderr}`
          : `Expected stderr to contain ${expected}\nActual stderr: ${received.stderr}`,
    };
  },

  toFailWith(received: CLIResult, expected: string | RegExp) {
    const failed = received.exitCode !== 0;
    const matches =
      typeof expected === "string"
        ? received.stderr.includes(expected)
        : expected.test(received.stderr);

    const pass = failed && matches;

    return {
      pass,
      message: () => {
        if (!failed) {
          return `Expected command to fail but it succeeded\nCommand: ${received.command}\nstdout: ${received.stdout}`;
        }
        if (!matches) {
          return `Expected stderr to contain ${expected}\nActual stderr: ${received.stderr}`;
        }
        return `Expected command NOT to fail with ${expected}\nActual stderr: ${received.stderr}`;
      },
    };
  },
};

expect.extend(cliMatchers);

declare module "vitest" {
  interface Assertion {
    toSucceed(): void;
    toFail(): void;
    toHaveOutput(expected: string | RegExp): void;
    toHaveError(expected: string | RegExp): void;
    toFailWith(expected: string | RegExp): void;
  }
  interface AsymmetricMatchersContaining {
    toSucceed(): void;
    toFail(): void;
    toHaveOutput(expected: string | RegExp): void;
    toHaveError(expected: string | RegExp): void;
    toFailWith(expected: string | RegExp): void;
  }
}
