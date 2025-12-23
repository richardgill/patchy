import { existsSync } from "node:fs";
import path from "node:path";
import { type SimpleGit, type SimpleGitOptions, simpleGit } from "simple-git";

export const isGitRepo = (dir: string): boolean =>
  existsSync(path.join(dir, ".git"));

const getCleanGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );

export const createGitClient = (
  options?: Partial<SimpleGitOptions>,
): SimpleGit =>
  (options ? simpleGit(options) : simpleGit()).env(getCleanGitEnv());

export const createTestGitClient = (
  options?: Partial<SimpleGitOptions>,
): SimpleGit =>
  (options ? simpleGit(options) : simpleGit()).env({
    ...getCleanGitEnv(),
    LEFTHOOK: "0",
  });

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
