import { applyPatch } from "diff";

export const applyDiff = (
  originalContent: string,
  diffContent: string,
): string => {
  const result = applyPatch(originalContent, diffContent, { fuzzFactor: 2 });

  if (result === false) {
    throw new Error("Patch failed to apply - context does not match");
  }

  return result;
};
