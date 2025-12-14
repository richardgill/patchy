import type { CLIResult } from "./cli-types";

export const acceptDefault = Symbol("acceptDefault");
export const cancel = Symbol("cancel");

export type PromptResponse =
  | string
  | boolean
  | typeof acceptDefault
  | typeof cancel;

type TextPromptInfo = {
  type: "text";
  message: string;
  placeholder?: string;
  defaultValue?: string;
};

type ConfirmPromptInfo = {
  type: "confirm";
  message: string;
  initialValue?: boolean;
};

export type PromptInfo = TextPromptInfo | ConfirmPromptInfo;

export type RecordedPrompt = PromptInfo & {
  response: string | boolean | "cancelled" | "default";
};

export type PromptHandler = (
  prompt: PromptInfo,
) => PromptResponse | Promise<PromptResponse>;

export type PromptedCliResult = {
  result: CLIResult;
  prompts: RecordedPrompt[];
};
