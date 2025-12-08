import { buildRouteMap } from "@stricli/core";
import { checkoutCommand } from "./checkout/command";

export const repoRoutes = buildRouteMap({
  routes: {
    checkout: checkoutCommand,
  },
  docs: {
    brief: "Repository management commands",
  },
});
