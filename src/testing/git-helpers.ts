import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  const git = createTestGitClient(repoDir);
  await git.addConfig("init.defaultBranch", "main");
  await git.checkout(["-b", "main"]);
  writeFileSync(join(repoDir, filename), content);
  await git.add(".");
  await git.commit("initial commit");
};

export const initBareRepoWithCommit = async (
  bareRepoDir: string,
  filename = "initial.txt",
  content = "initial content\n",
): Promise<void> => {
  const git = createTestGitClient(bareRepoDir);
  await git.init(true);
  const tmpWorkDir = join(bareRepoDir, "..", `tmp-work-${Date.now()}`);
  mkdirSync(tmpWorkDir, { recursive: true });
  const workGit = createTestGitClient(tmpWorkDir);
  await workGit.init();
  await workGit.addConfig("user.email", "test@test.com");
  await workGit.addConfig("user.name", "Test User");
  await workGit.addConfig("init.defaultBranch", "main");
  await workGit.checkout(["-b", "main"]);
  writeFileSync(join(tmpWorkDir, filename), content);
  await workGit.add(".");
  await workGit.commit("initial commit");
  await workGit.addRemote("origin", bareRepoDir);
  await workGit.push(["-u", "origin", "main"]);
  rmSync(tmpWorkDir, { recursive: true, force: true });
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

export const pushBranchToBareRepo = async (
  bareRepoDir: string,
  branchName: string,
): Promise<string> => {
  const tmpWorkDir = join(bareRepoDir, "..", `tmp-work-${Date.now()}`);
  mkdirSync(tmpWorkDir, { recursive: true });
  const workGit = createTestGitClient(tmpWorkDir);
  await workGit.clone(bareRepoDir, ".");
  await workGit.addConfig("user.email", "test@test.com");
  await workGit.addConfig("user.name", "Test User");
  await workGit.checkoutLocalBranch(branchName);
  writeFileSync(
    join(tmpWorkDir, "branch-file.txt"),
    `content from ${branchName}`,
  );
  await workGit.add(".");
  await workGit.commit(`commit on ${branchName}`);
  await workGit.push("origin", branchName);
  const sha = await workGit.revparse(["HEAD"]);
  rmSync(tmpWorkDir, { recursive: true, force: true });
  return sha.trim();
};

export const createTagInBareRepo = async (
  bareRepoDir: string,
  tagName: string,
): Promise<string> => {
  const tmpWorkDir = join(bareRepoDir, "..", `tmp-work-tag-${Date.now()}`);
  mkdirSync(tmpWorkDir, { recursive: true });
  const workGit = createTestGitClient(tmpWorkDir);
  await workGit.clone(bareRepoDir, ".");
  await workGit.addConfig("user.email", "test@test.com");
  await workGit.addConfig("user.name", "Test User");
  writeFileSync(
    join(tmpWorkDir, `${tagName}-file.txt`),
    `content for ${tagName}`,
  );
  await workGit.add(".");
  await workGit.commit(`commit for ${tagName}`);
  await workGit.addTag(tagName);
  await workGit.push("origin", tagName);
  const sha = await workGit.revparse(["HEAD"]);
  rmSync(tmpWorkDir, { recursive: true, force: true });
  return sha.trim();
};
