import { createGitClient } from "~/lib/git";

const stripIndexLine = (diff: string): string =>
  diff
    .split("\n")
    .filter((line) => !line.startsWith("index "))
    .join("\n");

export type GitChange = {
  type: "modified" | "new";
  path: string;
};

export const getGitChanges = async (repoDir: string): Promise<GitChange[]> => {
  const git = createGitClient({ baseDir: repoDir });

  const diffSummary = await git.diffSummary(["HEAD"]);
  const modifiedFiles: GitChange[] = diffSummary.files.map((file) => ({
    type: "modified",
    path: file.file,
  }));

  const status = await git.status();
  const newFiles: GitChange[] = [...status.not_added, ...status.created].map(
    (file) => ({ type: "new", path: file }),
  );

  return [...modifiedFiles, ...newFiles];
};

export const generateDiff = async (
  repoDir: string,
  filePath: string,
): Promise<string> => {
  const git = createGitClient({ baseDir: repoDir });
  const rawDiff = await git.diff(["HEAD", "--", filePath]);
  return stripIndexLine(rawDiff);
};
