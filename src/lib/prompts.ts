import * as clackPrompts from "@clack/prompts";
import type { LocalContext } from "~/context";

export const createPrompts = (context: LocalContext) => {
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
