import { buildRouteMap } from "@stricli/core";
import { checkoutCommand } from "./checkout/command";
import { cloneCommand } from "./clone/command";
import { resetCommand } from "./reset/command";

export const upstreamRoutes = buildRouteMap({
  routes: {
    checkout: checkoutCommand,
    clone: cloneCommand,
    reset: resetCommand,
  },
  docs: {
    brief: "Upstream repository management commands",
  },
});
