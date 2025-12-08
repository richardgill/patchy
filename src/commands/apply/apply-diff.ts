import { applyPatch } from "diff";

export const applyDiff = (
  originalContent: string,
  diffContent: string,
  fuzzFactor: number,
): string => {
  const result = applyPatch(originalContent, diffContent, { fuzzFactor });

  if (result === false) {
    throw new Error("Patch failed to apply - context does not match");
  }

  return result;
};
