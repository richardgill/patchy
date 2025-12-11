export const COMMAND_FLAGS = {
  yes: {
    stricliFlag: {
      yes: {
        kind: "boolean",
        brief: "Skip confirmation prompts",
        optional: true,
      },
    },
  },
} as const;
