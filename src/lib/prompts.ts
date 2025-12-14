import * as clackPrompts from "@clack/prompts";
import type { LocalContext } from "~/context";
import {
  acceptDefault,
  cancel,
  type PromptHandler,
  type PromptInfo,
  type RecordedPrompt,
} from "~/testing/prompt-testing-types";

const testCancelSymbol = Symbol("test:cancel");

type TestablePromptsOptions = {
  promptHandler: PromptHandler;
  onPromptRecord?: (prompt: RecordedPrompt) => void;
};

const createTestablePrompts = ({
  promptHandler,
  onPromptRecord,
}: TestablePromptsOptions) => {
  const processResponse = async <T extends string | boolean>(
    promptInfo: PromptInfo,
    defaultValue: T | undefined,
  ): Promise<T | symbol> => {
    const response = await promptHandler(promptInfo);

    let actualResponse: T | "cancelled" | "default";
    let returnValue: T | symbol;

    if (response === cancel) {
      actualResponse = "cancelled";
      returnValue = testCancelSymbol;
    } else if (response === acceptDefault) {
      if (defaultValue === undefined) {
        throw new Error(
          `acceptDefault used but prompt has no default value: ${promptInfo.message}`,
        );
      }
      actualResponse = "default";
      returnValue = defaultValue;
    } else {
      actualResponse = response as T;
      returnValue = response as T;
    }

    onPromptRecord?.({ ...promptInfo, response: actualResponse });
    return returnValue;
  };

  return {
    text: async (
      opts: Omit<Parameters<typeof clackPrompts.text>[0], "input" | "output">,
    ) => {
      const promptInfo: PromptInfo = {
        type: "text",
        message: opts.message as string,
        placeholder: opts.placeholder,
        defaultValue: opts.initialValue,
      };
      return processResponse<string>(promptInfo, opts.initialValue);
    },

    confirm: async (
      opts: Omit<
        Parameters<typeof clackPrompts.confirm>[0],
        "input" | "output"
      >,
    ) => {
      const promptInfo: PromptInfo = {
        type: "confirm",
        message: opts.message as string,
        initialValue: opts.initialValue,
      };
      return processResponse<boolean>(promptInfo, opts.initialValue);
    },

    isCancel: (value: unknown): value is symbol =>
      clackPrompts.isCancel(value) || value === testCancelSymbol,
    log: clackPrompts.log,
    outro: clackPrompts.outro,
  };
};

export const canPrompt = (context: LocalContext): boolean => {
  const inputStream = context.promptInput;
  const isTTY = Boolean(
    inputStream && "isTTY" in inputStream && inputStream.isTTY,
  );
  const hasPromptHandler = context.promptHandler !== undefined;
  return isTTY || hasPromptHandler;
};

export const createPrompts = (context: LocalContext) => {
  if (context.promptHandler) {
    return createTestablePrompts({
      promptHandler: context.promptHandler,
      onPromptRecord: context.onPromptRecord,
    });
  }

  const streamOpts = {
    input: context.promptInput,
    output: context.promptOutput,
  };

  return {
    text: (
      opts: Omit<Parameters<typeof clackPrompts.text>[0], "input" | "output">,
    ) => clackPrompts.text({ ...opts, ...streamOpts }),

    confirm: (
      opts: Omit<
        Parameters<typeof clackPrompts.confirm>[0],
        "input" | "output"
      >,
    ) => clackPrompts.confirm({ ...opts, ...streamOpts }),

    isCancel: clackPrompts.isCancel,
    log: clackPrompts.log,
    outro: clackPrompts.outro,
  };
};
