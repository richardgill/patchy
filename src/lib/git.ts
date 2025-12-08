import { type SimpleGit, simpleGit } from "simple-git";

const getCleanGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );

export const createGitClient = (baseDir: string): SimpleGit =>
  simpleGit({ baseDir }).env(getCleanGitEnv());
