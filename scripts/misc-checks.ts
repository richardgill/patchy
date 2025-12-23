#!/usr/bin/env bun

import { $, Glob } from "bun";
import chalk from "chalk";

const VALID_TEST_SUFFIXES = [
  ".unit.test.ts",
  ".integration.test.ts",
  ".e2e.test.ts",
];

const findInvalidTestFiles = async (): Promise<string[]> => {
  const glob = new Glob("**/*.test.ts");
  const invalidFiles: string[] = [];
  const directories = ["src", "scripts"];

  for (const dir of directories) {
    for await (const file of glob.scan({ cwd: dir })) {
      const isValid = VALID_TEST_SUFFIXES.some((suffix) =>
        file.endsWith(suffix),
      );
      if (!isValid) {
        invalidFiles.push(`${dir}/${file}`);
      }
    }
  }

  return invalidFiles.sort();
};

const checkTestNaming = async (): Promise<boolean> => {
  const invalidFiles = await findInvalidTestFiles();

  if (invalidFiles.length === 0) {
    console.log(chalk.green("✓ All test files use valid naming conventions"));
    console.log(
      chalk.dim(`  Valid patterns: ${VALID_TEST_SUFFIXES.join(", ")}`),
    );
    return true;
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
    chalk.dim(
      `\nTest files must end with: ${VALID_TEST_SUFFIXES.join(" or ")}`,
    ),
  );
  console.log(chalk.dim("Rename files to use .unit.test.ts or .e2e.test.ts"));
  return false;
};

const checkVersions = async (): Promise<boolean> => {
  const result = await $`syncpack lint`.quiet().nothrow();

  if (result.exitCode === 0) {
    console.log(chalk.green("✓ Package versions are valid"));
    return true;
  }

  console.log(chalk.red("✗ Package version issues found:\n"));
  console.log(result.text());
  return false;
};

const main = async () => {
  console.log(chalk.bold("Running miscellaneous checks...\n"));

  const results = await Promise.all([checkTestNaming(), checkVersions()]);

  const allPassed = results.every(Boolean);

  if (!allPassed) {
    console.log(chalk.red("\n✗ Some checks failed"));
    process.exit(1);
  }

  console.log(chalk.green("\n✓ All checks passed"));
};

main();
