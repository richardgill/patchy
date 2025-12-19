import { buildApplication, buildRouteMap } from "@stricli/core";
import { applyCommand } from "./commands/apply/command";
import { baseCommand } from "./commands/base/command";
import { generateCommand } from "./commands/generate/command";
import { initCommand } from "./commands/init/command";
import { repoRoutes } from "./commands/repo/routes";
import { VERSION } from "./version";

const routes = buildRouteMap({
  routes: {
    init: initCommand,
    apply: applyCommand,
    generate: generateCommand,
    base: baseCommand,
    repo: repoRoutes,
  },
  docs: {
    brief: "A CLI tool for managing Git patch workflows",
  },
});

export const app = buildApplication(routes, {
  name: "patchy",
  versionInfo: {
    currentVersion: VERSION,
  },
});
