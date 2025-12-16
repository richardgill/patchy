import type { CLIResult } from "./cli-types";
import {
  acceptDefault,
  cancel,
  type PromptedCliResult,
  type PromptInfo,
  type PromptResponse,
  type RecordedPrompt,
} from "./prompt-testing-types";

type TextMatcher = {
  type: "text";
  pattern: RegExp | string;
  response: string | typeof acceptDefault | typeof cancel;
};

type ConfirmMatcher = {
  type: "confirm";
  pattern: RegExp | string;
  response: boolean | typeof acceptDefault | typeof cancel;
};

type SelectMatcher = {
  type: "select";
  pattern: RegExp | string;
  response: string | typeof acceptDefault | typeof cancel;
};

type InternalMatcher = TextMatcher | ConfirmMatcher | SelectMatcher;

type TextMatcherConfig = {
  text: RegExp | string;
  respond: string | typeof acceptDefault | typeof cancel;
};

type ConfirmMatcherConfig = {
  confirm: RegExp | string;
  respond: boolean | typeof acceptDefault | typeof cancel;
};

type SelectMatcherConfig = {
  select: RegExp | string;
  respond: string | typeof acceptDefault | typeof cancel;
};

type MatcherConfig =
  | TextMatcherConfig
  | ConfirmMatcherConfig
  | SelectMatcherConfig;

export type PromptBuilder = {
  on: (config: MatcherConfig) => PromptBuilder;
  run: () => Promise<PromptedCliResult>;
};

const matchesPattern = (message: string, pattern: RegExp | string): boolean => {
  if (typeof pattern === "string") {
    return message.includes(pattern);
  }
  return pattern.test(message);
};

const findResponse = (
  prompt: PromptInfo,
  matchers: InternalMatcher[],
): PromptResponse => {
  for (const matcher of matchers) {
    if (
      matcher.type === prompt.type &&
      matchesPattern(prompt.message, matcher.pattern)
    ) {
      return matcher.response;
    }
  }
  throw new Error(
    `Unhandled prompt: ${JSON.stringify(prompt)}\n` +
      `Registered matchers: ${matchers.map((m) => `${m.type}:${m.pattern}`).join(", ")}`,
  );
};

export const createPromptBuilder = (
  runFn: (
    handler: (prompt: PromptInfo) => PromptResponse,
    onRecord: (p: RecordedPrompt) => void,
  ) => Promise<CLIResult>,
): PromptBuilder => {
  const matchers: InternalMatcher[] = [];
  const recorded: RecordedPrompt[] = [];

  const builder: PromptBuilder = {
    on: (config) => {
      const hasText = "text" in config;
      const hasConfirm = "confirm" in config;
      const hasSelect = "select" in config;

      const count = [hasText, hasConfirm, hasSelect].filter(Boolean).length;
      if (count !== 1) {
        throw new Error(
          "Invalid matcher config: must have exactly one of 'text', 'confirm', or 'select'",
        );
      }

      if (hasText) {
        matchers.push({
          type: "text",
          pattern: config.text,
          response: config.respond,
        });
      } else if (hasConfirm) {
        matchers.push({
          type: "confirm",
          pattern: (config as ConfirmMatcherConfig).confirm,
          response: config.respond,
        });
      } else {
        matchers.push({
          type: "select",
          pattern: (config as SelectMatcherConfig).select,
          response: config.respond,
        });
      }
      return builder;
    },

    run: async () => {
      const result = await runFn(
        (p) => findResponse(p, matchers),
        (p) => recorded.push(p),
      );
      return { result, prompts: recorded };
    },
  };

  return builder;
};

export { acceptDefault, cancel };
