#!/usr/bin/env bun

import { $ } from "bun";

type CommandResult = {
  command: string;
  exitCode: number;
  output: string;
};

const runCommand = async (command: string): Promise<CommandResult> => {
  const result = await $`${command.split(" ")}`.nothrow().quiet();
  const output = result.stdout.toString() + result.stderr.toString();
  return { command, exitCode: result.exitCode, output };
};

const commands = [
  "bun run typecheck",
  "bun run check",
  "bun run check-test-naming",
  "bun run test",
  "bun run knip",
  "bun run lint-versions",
];

console.log(`Running local-ci: ${commands.join(", ")}\n`);

const results = await Promise.all(commands.map(runCommand));

const successes = results.filter((r) => r.exitCode === 0);
const failures = results.filter((r) => r.exitCode !== 0);

for (const result of successes) {
  console.log(`✅ ${result.command} success`);
}

for (const result of failures) {
  console.log(`\n❌ ${result.command} failed:\n`);
  console.log(result.output);
}

if (failures.length > 0) {
  console.error("\nPlease fix the issues above");
  // Exit code 2 tells Claude Code to stop and let the user handle the issues
  process.exit(2);
}
