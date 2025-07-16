import { buildApplication, buildRouteMap } from "@stricli/core";
import { initCommand } from "./commands/init/command.js";

const routes = buildRouteMap({
  routes: {
    init: initCommand,
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
