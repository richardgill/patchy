#!/usr/bin/env node

import { run } from "@stricli/core";
import { app } from "./app";
import type { LocalContext } from "./context";
import { buildContext } from "./context";
import { isAiAgent } from "./lib/env";

export const isRootHelpRequest = (args: string[]): boolean => {
  const filtered = args.filter((a) => a !== "--" && !a.startsWith("-"));
  return (
    filtered.length === 0 && (args.includes("--help") || args.includes("-h"))
  );
};

export const runCli = async (
  args: string[],
  context: LocalContext,
): Promise<void> => {
  await run(app, args, context);

  if (isRootHelpRequest(args) && isAiAgent(context)) {
    const tip = `
TIP: Run \`patchy prime\` to understand this project's patch workflow.
     Include its output in your context (e.g., CLAUDE.md) for best results.
`;
    context.process.stdout.write(tip);
  }
};

try {
  const cwd = process.env["PATCHY_CWD"] ?? process.cwd();
  const args = process.argv.slice(2);
  const context = buildContext(process, cwd);

  await runCli(args, context);
} catch {
  process.exit(1);
}
