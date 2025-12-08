import { existsSync, mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const ensureDirExists = (dirPath: string): void => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

export const getAllFiles = async (
  dir: string,
  currentPath = "",
): Promise<string[]> => {
  const entries = await readdir(path.join(dir, currentPath), {
    withFileTypes: true,
  });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFiles(dir, relativePath);
      }
      return entry.isFile() ? [relativePath] : [];
    }),
  );

  return nested.flat();
};
