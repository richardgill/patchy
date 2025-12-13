#!/usr/bin/env bun

import { $ } from "bun";
import chalk from "chalk";

const hasFixableIssues = (output: string): boolean => {
  const hasFixableLint = output.includes("FIXABLE");
  const hasFormatErrors = output.includes(" format ");
  return hasFixableLint || hasFormatErrors;
};

const result =
  await $`biome check --error-on-warnings --diagnostic-level=warn --colors=force`.nothrow();

const output = result.stdout.toString() + result.stderr.toString();

if (result.exitCode !== 0 && hasFixableIssues(output)) {
  console.log(
    chalk.yellow(
      "\n💡 Some issues can be auto-fixed. Run: bun run check-fix\n",
    ),
  );
}

process.exit(result.exitCode);
