import { buildRouteMap } from "@stricli/core";
import { configGetCommand } from "./get/command";
import { configListCommand } from "./list/command";

export const configRoutes = buildRouteMap({
  routes: {
    get: configGetCommand,
    list: configListCommand,
  },
  docs: {
    brief: "Configuration commands",
  },
});
