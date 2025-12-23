import { existsSync, readFileSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeGitignoreEntry } from "~/lib/git";

export const addToGitignoreFile = async (
  cwd: string,
  entry: string,
): Promise<void> => {
  const gitignorePath = resolve(cwd, ".gitignore");
  const normalizedEntry = normalizeGitignoreEntry(entry);

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    const lines = content.split("\n");
    const hasEntry = lines.some(
      (line) => line === normalizedEntry || line === entry,
    );
    if (hasEntry) {
      return;
    }
    const needsSeparator = content.length > 0 && !content.endsWith("\n");
    const separator = needsSeparator ? "\n" : "";
    await appendFile(gitignorePath, `${separator}${normalizedEntry}\n`);
  } else {
    await writeFile(gitignorePath, `${normalizedEntry}\n`);
  }
};
