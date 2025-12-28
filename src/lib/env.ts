import type { LocalContext } from "~/context";

export const isCI = (context: LocalContext): boolean => {
  const ci = context.process.env["CI"];
  return ci === "true" || ci === "1";
};

// Based on https://github.com/vercel/vercel/blob/main/packages/detect-agent/src/index.ts
// Extended with CLAUDE_CODE_ACTION (GitHub Actions) and future-proofing vars
export const isAiAgent = (context: LocalContext): boolean => {
  const env = context.process.env;
  return Boolean(
    env["CLAUDECODE"] ||
      env["CLAUDE_CODE"] ||
      env["CLAUDE_CODE_ACTION"] ||
      env["CURSOR_TRACE_ID"] ||
      env["CURSOR_AGENT"] ||
      env["GEMINI_CLI"] ||
      env["CODEX_SANDBOX"] ||
      env["REPL_ID"] ||
      env["CLINE"] ||
      env["AIDER"] ||
      env["WINDSURF"] ||
      env["AI_AGENT"],
  );
};
