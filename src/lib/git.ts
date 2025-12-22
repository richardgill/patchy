import { existsSync } from "node:fs";
import path from "node:path";
import { type SimpleGit, simpleGit } from "simple-git";

export const isGitRepo = (dir: string): boolean =>
  existsSync(path.join(dir, ".git"));

const getCleanGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );

export const createGitClient = (baseDir: string): SimpleGit =>
  simpleGit({ baseDir }).env(getCleanGitEnv());

export const createTestGitClient = (baseDir: string): SimpleGit =>
  simpleGit({ baseDir }).env({ ...getCleanGitEnv(), LEFTHOOK: "0" });

export const normalizeGitignoreEntry = (entry: string): string => {
  const withTrailingSlash = entry.endsWith("/") ? entry : `${entry}/`;
  return withTrailingSlash.replace(/^(\.\/)+/, "");
};

export const extractRepoName = (url: string): string | undefined => {
  const httpsMatch = url.match(/\/([^/]+?)(\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }
  const sshMatch = url.match(/:([^/]+\/)?([^/]+?)(\.git)?$/);
  if (sshMatch) {
    return sshMatch[2];
  }
  return undefined;
};
