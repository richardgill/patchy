import { applyPatch, parsePatch } from "diff";

type Hunk = ReturnType<typeof parsePatch>[0]["hunks"][0];

const MAX_FUZZY_SEARCH_OFFSET = 50;
const MIN_FUZZY_MATCH_RATIO = 0.5;

type ConflictInfo = {
  hunkIndex: number;
  location: number;
  reason: string;
};

type ApplyDiffResult =
  | { success: true; content: string }
  | { success: false; content: string; conflicts: ConflictInfo[] };

type MatchResult = {
  index: number;
  exactMatch: boolean;
};

const linesMatch = (
  fileLines: string[],
  expectedLines: string[],
  startIndex: number,
): boolean => {
  if (startIndex < 0 || startIndex + expectedLines.length > fileLines.length) {
    return false;
  }
  return expectedLines.every((line, i) => fileLines[startIndex + i] === line);
};

const matchScore = (
  fileLines: string[],
  expectedLines: string[],
  startIndex: number,
): number => {
  if (startIndex < 0 || startIndex + expectedLines.length > fileLines.length) {
    return 0;
  }
  return expectedLines.filter((line, i) => fileLines[startIndex + i] === line)
    .length;
};

const searchNearbyWindow = (
  fileLines: string[],
  expectedLines: string[],
  hintIndex: number,
): MatchResult | null => {
  for (let offset = 1; offset <= MAX_FUZZY_SEARCH_OFFSET; offset++) {
    if (linesMatch(fileLines, expectedLines, hintIndex - offset)) {
      return { index: hintIndex - offset, exactMatch: true };
    }
    if (linesMatch(fileLines, expectedLines, hintIndex + offset)) {
      return { index: hintIndex + offset, exactMatch: true };
    }
  }
  return null;
};

const scanForExactMatch = (
  fileLines: string[],
  expectedLines: string[],
  hintIndex: number,
): MatchResult | null => {
  let closestExactIndex = -1;
  let closestExactDistance = Infinity;

  for (let i = 0; i <= fileLines.length - expectedLines.length; i++) {
    if (linesMatch(fileLines, expectedLines, i)) {
      const distance = Math.abs(i - hintIndex);
      if (distance < closestExactDistance) {
        closestExactIndex = i;
        closestExactDistance = distance;
      }
    }
  }

  if (closestExactIndex !== -1) {
    return { index: closestExactIndex, exactMatch: true };
  }
  return null;
};

const findFuzzyMatch = (
  fileLines: string[],
  expectedLines: string[],
  hintIndex: number,
): MatchResult => {
  let bestScore = 0;
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i <= fileLines.length - expectedLines.length; i++) {
    const score = matchScore(fileLines, expectedLines, i);
    const distance = Math.abs(i - hintIndex);
    if (score > bestScore || (score === bestScore && distance < bestDistance)) {
      bestScore = score;
      bestIndex = i;
      bestDistance = distance;
    }
  }

  if (bestScore >= expectedLines.length * MIN_FUZZY_MATCH_RATIO) {
    return { index: bestIndex, exactMatch: false };
  }

  return { index: -1, exactMatch: false };
};

const findBestMatch = (
  fileLines: string[],
  expectedLines: string[],
  hintIndex: number,
): MatchResult => {
  if (expectedLines.length === 0) {
    const insertIndex = Math.max(0, Math.min(hintIndex, fileLines.length));
    return { index: insertIndex, exactMatch: true };
  }

  if (linesMatch(fileLines, expectedLines, hintIndex)) {
    return { index: hintIndex, exactMatch: true };
  }

  const nearbyMatch = searchNearbyWindow(fileLines, expectedLines, hintIndex);
  if (nearbyMatch) return nearbyMatch;

  const fullScanMatch = scanForExactMatch(fileLines, expectedLines, hintIndex);
  if (fullScanMatch) return fullScanMatch;

  return findFuzzyMatch(fileLines, expectedLines, hintIndex);
}; // 23 lines: orchestrates search strategy for hunk location

const extractHunkLines = (
  hunk: Hunk,
): { expectedLines: string[]; desiredLines: string[] } => {
  const expectedLines = hunk.lines
    .filter((l) => l[0] === " " || l[0] === "-")
    .map((l) => l.slice(1));

  const desiredLines = hunk.lines
    .filter((l) => l[0] === " " || l[0] === "+")
    .map((l) => l.slice(1));

  return { expectedLines, desiredLines };
};

const buildConflictBlock = (
  currentLines: string[],
  desiredLines: string[],
  patchName: string,
): string[] => [
  "<<<<<<< current",
  ...currentLines,
  "=======",
  ...desiredLines,
  `>>>>>>> ${patchName}`,
];

const splitIntoLines = (content: string): string[] => {
  if (content === "") return [];
  return content.split("\n");
};

const applyHunksWithConflicts = (
  originalContent: string,
  diffContent: string,
  patchName: string,
): ApplyDiffResult => {
  const [parsed] = parsePatch(diffContent);
  if (!parsed || parsed.hunks.length === 0) {
    return {
      success: false,
      content: originalContent,
      conflicts: [
        { hunkIndex: 0, location: 0, reason: "No hunks found in patch" },
      ],
    };
  }

  const lines = splitIntoLines(originalContent);
  const conflicts: ConflictInfo[] = [];
  let offset = 0;

  for (let hunkIndex = 0; hunkIndex < parsed.hunks.length; hunkIndex++) {
    const hunk = parsed.hunks[hunkIndex];
    const { expectedLines, desiredLines } = extractHunkLines(hunk);
    const hintIndex = hunk.oldStart - 1 + offset;
    const matchResult = findBestMatch(lines, expectedLines, hintIndex);

    if (matchResult.exactMatch) {
      const sizeDiff = desiredLines.length - expectedLines.length;
      lines.splice(matchResult.index, expectedLines.length, ...desiredLines);
      offset += sizeDiff;
    } else if (matchResult.index !== -1) {
      const currentLines = lines.slice(
        matchResult.index,
        matchResult.index + expectedLines.length,
      );
      const conflictBlock = buildConflictBlock(
        currentLines,
        desiredLines,
        patchName,
      );
      const sizeDiff = conflictBlock.length - currentLines.length;
      lines.splice(matchResult.index, currentLines.length, ...conflictBlock);
      offset += sizeDiff;

      conflicts.push({
        hunkIndex,
        location: matchResult.index + 1,
        reason: "Content differs from expected",
      });
    } else {
      conflicts.push({
        hunkIndex,
        location: hunk.oldStart,
        reason: "Could not locate hunk in file",
      });
    }
  }

  if (conflicts.length === 0) {
    return { success: true, content: lines.join("\n") };
  }

  return { success: false, content: lines.join("\n"), conflicts };
};

export const applyDiffWithConflicts = (
  originalContent: string,
  diffContent: string,
  options: { fuzzFactor: number; patchName: string },
): ApplyDiffResult => {
  const { fuzzFactor, patchName } = options;

  const cleanResult = applyPatch(originalContent, diffContent, { fuzzFactor });
  if (cleanResult !== false) {
    return { success: true, content: cleanResult };
  }

  return applyHunksWithConflicts(originalContent, diffContent, patchName);
};

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
