import { buildApplication, buildRouteMap } from "@stricli/core";
import { applyCommand } from "./commands/apply/command";
import { baseCommand } from "./commands/base/command";
import { configRoutes } from "./commands/config/routes";
import { generateCommand } from "./commands/generate/command";
import { initCommand } from "./commands/init/command";
import { primeCommand } from "./commands/prime/command";
import { repoRoutes } from "./commands/repo/routes";
import { VERSION } from "./version";

const routes = buildRouteMap({
  routes: {
    init: initCommand,
    apply: applyCommand,
    generate: generateCommand,
    prime: primeCommand,
    base: baseCommand,
    config: configRoutes,
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
  // Use kebab-case for flags (--no-verbose instead of --noVerbose)
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
});
