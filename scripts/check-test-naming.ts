#!/usr/bin/env bun

import { Glob } from "bun";
import chalk from "chalk";

const VALID_SUFFIXES = [".unit.test.ts", ".e2e.test.ts"];

const findInvalidTestFiles = async (): Promise<string[]> => {
  const glob = new Glob("**/*.test.ts");
  const invalidFiles: string[] = [];
  const directories = ["src", "scripts"];

  for (const dir of directories) {
    for await (const file of glob.scan({ cwd: dir })) {
      const isValid = VALID_SUFFIXES.some((suffix) => file.endsWith(suffix));
      if (!isValid) {
        invalidFiles.push(`${dir}/${file}`);
      }
    }
  }

  return invalidFiles.sort();
};

const main = async () => {
  const invalidFiles = await findInvalidTestFiles();

  if (invalidFiles.length === 0) {
    console.log(chalk.green("✓ All test files use valid naming conventions"));
    console.log(chalk.dim(`  Valid patterns: ${VALID_SUFFIXES.join(", ")}`));
    process.exit(0);
  }

  console.log(
    chalk.red(
      `✗ Found ${invalidFiles.length} test file(s) with invalid naming:\n`,
    ),
  );

  for (const file of invalidFiles) {
    console.log(chalk.yellow(`  ${file}`));
  }

  console.log(
    chalk.dim(`\nTest files must end with: ${VALID_SUFFIXES.join(" or ")}`),
  );
  console.log(chalk.dim("Rename files to use .unit.test.ts or .e2e.test.ts"));
  process.exit(1);
};

main();
