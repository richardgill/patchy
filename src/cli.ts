#!/usr/bin/env node

import { run } from "@stricli/core";
import { app } from "./app";
import { buildContext } from "./context";

try {
  await run(app, process.argv.slice(2), buildContext(process, process.cwd()));
} catch {
  process.exit(1);
}
