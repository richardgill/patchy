import { expect } from "bun:test";
import type { CLIResult } from "~/testing/test-utils";

export const cliMatchers = {
  toSucceed(expected: unknown) {
    const result = expected as CLIResult;
    const pass = result.exitCode === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected command to fail but it succeeded\nCommand: ${result.command}\nstdout: ${result.stdout}`
          : `Expected command to succeed but it failed with exit code ${result.exitCode}\nCommand: ${result.command}\nstderr: ${result.stderr}\nstdout: ${result.stdout}`,
    };
  },

  toFail(expected: unknown) {
    const result = expected as CLIResult;
    const pass = result.exitCode !== 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected command to succeed but it failed with exit code ${result.exitCode}\nCommand: ${result.command}\nstderr: ${result.stderr}`
          : `Expected command to fail but it succeeded\nCommand: ${result.command}\nstdout: ${result.stdout}`,
    };
  },

  toHaveOutput(expected: unknown, matchValue: string | RegExp) {
    const result = expected as CLIResult;
    const matches =
      typeof matchValue === "string"
        ? result.stdout.includes(matchValue)
        : matchValue.test(result.stdout);

    return {
      pass: matches,
      message: () =>
        matches
          ? `Expected stdout NOT to contain ${matchValue}\nActual stdout: ${result.stdout}`
          : `Expected stdout to contain ${matchValue}\nActual stdout: ${result.stdout}`,
    };
  },

  toHaveError(expected: unknown, matchValue: string | RegExp) {
    const result = expected as CLIResult;
    const matches =
      typeof matchValue === "string"
        ? result.stderr.includes(matchValue)
        : matchValue.test(result.stderr);

    return {
      pass: matches,
      message: () =>
        matches
          ? `Expected stderr NOT to contain ${matchValue}\nActual stderr: ${result.stderr}`
          : `Expected stderr to contain ${matchValue}\nActual stderr: ${result.stderr}`,
    };
  },

  toFailWith(expected: unknown, matchValue: string | RegExp) {
    const result = expected as CLIResult;
    const failed = result.exitCode !== 0;
    const matches =
      typeof matchValue === "string"
        ? result.stderr.includes(matchValue)
        : matchValue.test(result.stderr);

    const pass = failed && matches;

    return {
      pass,
      message: () => {
        if (!failed) {
          return `Expected command to fail but it succeeded\nCommand: ${result.command}\nstdout: ${result.stdout}`;
        }
        if (!matches) {
          return `Expected stderr to contain ${matchValue}\nActual stderr: ${result.stderr}`;
        }
        return `Expected command NOT to fail with ${matchValue}\nActual stderr: ${result.stderr}`;
      },
    };
  },
};

expect.extend(cliMatchers);

declare module "bun:test" {
  // biome-ignore lint/correctness/noUnusedVariables: T must match bun-types Matchers<T> signature
  interface Matchers<T> {
    toSucceed(): void;
    toFail(): void;
    toHaveOutput(expected: string | RegExp): void;
    toHaveError(expected: string | RegExp): void;
    toFailWith(expected: string | RegExp): void;
  }
}
