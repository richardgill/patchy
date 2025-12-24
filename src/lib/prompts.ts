import * as clackPrompts from "@clack/prompts";
import type { LocalContext } from "~/context";
import { isCI } from "~/lib/env";
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

    select: async (opts: {
      message: string;
      options: Array<{ value: string; label: string }>;
    }) => {
      const promptInfo: PromptInfo = {
        type: "select",
        message: opts.message,
        options: opts.options,
      };
      return processResponse<string>(promptInfo, undefined);
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
  return !isCI(context) && (isTTY || hasPromptHandler);
};

export const promptForManualSha = async (
  prompts: Prompts,
): Promise<string | symbol> => {
  const manualSha = await prompts.text({
    message: "Enter commit SHA or tag:",
    placeholder: "e.g., abc123def or v1.0.0",
    validate: (sha) => {
      if (!sha || sha.trim().length === 0) {
        return "Please enter a valid SHA or tag";
      }
      return undefined;
    },
  });

  return manualSha;
};

export type Prompts = ReturnType<typeof createPrompts>;

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

    select: (opts: {
      message: string;
      options: Array<{ value: string; label: string }>;
    }) =>
      clackPrompts.select({
        message: opts.message,
        options: opts.options.map((o) => ({ value: o.value, label: o.label })),
        ...streamOpts,
      }),

    isCancel: clackPrompts.isCancel,
    log: clackPrompts.log,
    outro: clackPrompts.outro,
  };
};
