import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import untildify from "untildify";

export const resolvePath = (cwd: string, targetPath: string): string => {
  return path.resolve(cwd, untildify(targetPath));
};

export const isPathWithinDir = (dir: string, targetPath: string): boolean => {
  const absoluteTarget = resolvePath(dir, targetPath);
  const relativePath = path.relative(dir, absoluteTarget);
  // Path is within dir if:
  // - It's not the dir itself (relativePath is empty string for same dir)
  // - Relative path doesn't start with ".." (meaning it's a parent/sibling)
  // - Relative path isn't absolute (Windows: different drives)
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
};

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

export const removeFile = (filePath: string): void => {
  rmSync(filePath, { force: true });
};
