import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createTestGitClient } from "~/lib/git";

/**
 * Initialize a git repository with basic config
 */
export const initGitRepo = async (repoDir: string): Promise<void> => {
  const git = createTestGitClient(repoDir);
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");
};

/**
 * Initialize a git repository with an initial commit containing a file
 */
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

/**
 * Create a file and commit it
 */
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

/**
 * Create or modify a file in the repo (sync version, creates parent dirs)
 */
export const writeRepoFile = (
  repoDir: string,
  filePath: string,
  content: string,
): void => {
  const fullPath = join(repoDir, filePath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fullPath, content);
};

/**
 * Create or modify a file in the repo (async version)
 */
export const writeRepoFileAsync = async (
  repoDir: string,
  filename: string,
  content: string,
): Promise<void> => {
  const filePath = join(repoDir, filename);
  await writeFile(filePath, content);
};

/**
 * Create a branch with a commit and return to previous branch
 */
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

/**
 * Create a tag at current HEAD
 */
export const createTag = async (
  repoDir: string,
  tagName: string,
): Promise<void> => {
  const git = createTestGitClient(repoDir);
  await git.addTag(tagName);
};

/**
 * Get the current branch name
 */
export const getCurrentBranch = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient(repoDir);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
};

/**
 * Get the current commit SHA
 */
export const getCurrentCommit = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient(repoDir);
  const commit = await git.revparse(["HEAD"]);
  return commit.trim();
};
