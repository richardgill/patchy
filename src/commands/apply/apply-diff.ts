type Hunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
};

const parseHunkHeader = (
  line: string,
): {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
} | null => {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;

  return {
    oldStart: Number.parseInt(match[1], 10),
    oldCount: match[2] ? Number.parseInt(match[2], 10) : 1,
    newStart: Number.parseInt(match[3], 10),
    newCount: match[4] ? Number.parseInt(match[4], 10) : 1,
  };
};

const parseDiff = (diffContent: string): Hunk[] => {
  const lines = diffContent.split("\n");
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    const hunkHeader = parseHunkHeader(line);
    if (hunkHeader) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        ...hunkHeader,
        lines: [],
      };
      continue;
    }

    if (
      currentHunk &&
      (line.startsWith(" ") || line.startsWith("-") || line.startsWith("+"))
    ) {
      currentHunk.lines.push(line);
    } else if (currentHunk && line === "") {
      currentHunk.lines.push(" ");
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
};

export const applyDiff = (
  originalContent: string,
  diffContent: string,
): string => {
  const hunks = parseDiff(diffContent);

  if (hunks.length === 0) {
    return originalContent;
  }

  const originalLines = originalContent.split("\n");
  const resultLines: string[] = [];
  let originalIndex = 0;

  for (const hunk of hunks) {
    const hunkStartIndex = hunk.oldStart - 1;

    for (
      let i = originalIndex;
      i < hunkStartIndex && i < originalLines.length;
      i++
    ) {
      resultLines.push(originalLines[i]);
    }
    originalIndex = hunkStartIndex;

    for (const line of hunk.lines) {
      const prefix = line[0];
      const content = line.slice(1);

      if (prefix === " ") {
        resultLines.push(content);
        originalIndex++;
      } else if (prefix === "-") {
        originalIndex++;
      } else if (prefix === "+") {
        resultLines.push(content);
      }
    }
  }

  for (let i = originalIndex; i < originalLines.length; i++) {
    resultLines.push(originalLines[i]);
  }

  return resultLines.join("\n");
};
