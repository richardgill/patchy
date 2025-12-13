import { writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestGitClient } from "~/lib/git";

export const initGitRepo = async (repoDir: string): Promise<void> => {
  const git = createTestGitClient(repoDir);
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");
};

export const initGitRepoWithCommit = async (
  repoDir: string,
  filename = "initial.txt",
  content = "initial content\n",
): Promise<void> => {
  await initGitRepo(repoDir);
  writeFileSync(join(repoDir, filename), content);
  const git = createTestGitClient(repoDir);
  await git.add(".");
  await git.commit("initial commit");
};

export const commitFile = async (
  repoDir: string,
  filename: string,
  content: string,
  message = `Add ${filename}`,
): Promise<void> => {
  const filePath = join(repoDir, filename);
  await writeFile(filePath, content);
  const git = createTestGitClient(repoDir);
  await git.add(filename);
  await git.commit(message);
};

export const createBranch = async (
  repoDir: string,
  branchName: string,
  filename = "branch-file.txt",
  content?: string,
): Promise<void> => {
  const git = createTestGitClient(repoDir);
  await git.checkoutLocalBranch(branchName);
  writeFileSync(
    join(repoDir, filename),
    content ?? `content from ${branchName}`,
  );
  await git.add(".");
  await git.commit(`commit on ${branchName}`);
  await git.checkout("-");
};

export const createTag = async (
  repoDir: string,
  tagName: string,
): Promise<void> => {
  const git = createTestGitClient(repoDir);
  await git.addTag(tagName);
};

export const getCurrentBranch = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient(repoDir);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
};

export const getCurrentCommit = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient(repoDir);
  const commit = await git.revparse(["HEAD"]);
  return commit.trim();
};
