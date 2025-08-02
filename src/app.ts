import { buildApplication, buildRouteMap } from "@stricli/core";
import { applyCommand } from "./commands/apply/command";
import { generateCommand } from "./commands/generate/command";
import { initCommand } from "./commands/init/command";

const routes = buildRouteMap({
  routes: {
    init: initCommand,
    apply: applyCommand,
    generate: generateCommand,
  },
  docs: {
    brief: "A CLI tool for managing Git patch workflows",
  },
});

export const app = buildApplication(routes, {
  name: "patchy",
  versionInfo: {
    currentVersion: "0.0.0",
  },
});
