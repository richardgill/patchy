#!/usr/bin/env node

import { run } from "@stricli/core";
import { app } from "./app";
import { buildContext } from "./context";

try {
  const cwd = process.env["PATCHY_CWD"] ?? process.cwd();
  await run(app, process.argv.slice(2), buildContext(process, cwd));
} catch {
  process.exit(1);
}
