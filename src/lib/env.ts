import type { LocalContext } from "~/context";

export const isCI = (context: LocalContext): boolean => {
  const ci = context.process.env["CI"];
  return ci === "true" || ci === "1";
};
