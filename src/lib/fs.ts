import { existsSync, mkdirSync } from "node:fs";

export const ensureDirExists = (dirPath: string): void => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};
