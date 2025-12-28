#!/usr/bin/env node

import { run } from "@stricli/core";
import { app } from "./app";
import { buildContext } from "./context";
import { isAiAgent } from "./lib/env";

const isRootHelpRequest = (args: string[]): boolean => {
  const filtered = args.filter((a) => a !== "--" && !a.startsWith("-"));
  return (
    filtered.length === 0 && (args.includes("--help") || args.includes("-h"))
  );
};

const showAiAgentTip = (): void => {
  const tip = `
TIP: Run \`patchy prime\` to understand this project's patch workflow.
     Include its output in your context (e.g., CLAUDE.md) for best results.
`;
  process.stdout.write(tip);
};

try {
  const cwd = process.env["PATCHY_CWD"] ?? process.cwd();
  const args = process.argv.slice(2);
  const context = buildContext(process, cwd);

  await run(app, args, context);

  if (isRootHelpRequest(args) && isAiAgent(context)) {
    showAiAgentTip();
  }
} catch {
  process.exit(1);
}
