import { buildRouteMap } from "@stricli/core";
import { cloneCommand } from "./clone/command";
import { resetCommand } from "./reset/command";

export const repoRoutes = buildRouteMap({
  routes: {
    clone: cloneCommand,
    reset: resetCommand,
  },
  docs: {
    brief: "Repository management commands",
  },
});
