import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestGitClient } from "~/lib/git";
import { generateTmpDir } from "./fs-test-utils";
import type { FileMap } from "./testing-types";

const initGitRepo = async (repoDir: string): Promise<void> => {
  const git = createTestGitClient({ baseDir: repoDir });
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");
};

type TestRepoOptions = {
  dir?: string;
  files?: FileMap;
  commits?: number;
  branches?: string[];
  tags?: string[];
};

type AddRefsContext = {
  git: ReturnType<typeof createTestGitClient>;
  workDir: string;
  pushTo?: string;
};

const addRefsToRepo = async (
  ctx: AddRefsContext,
  options: TestRepoOptions,
): Promise<void> => {
  const { commits = 0, branches = [], tags = [] } = options;
  const { git, workDir, pushTo } = ctx;

  for (let i = 0; i < commits; i++) {
    writeFileSync(join(workDir, `commit-${i + 1}.txt`), `content ${i + 1}`);
    await git.add(".");
    await git.commit(`commit ${i + 1}`);
    if (pushTo) await git.push(pushTo, "main");
  }

  for (const branch of branches) {
    await git.checkoutLocalBranch(branch);
    writeFileSync(join(workDir, `${branch}.txt`), `content for ${branch}`);
    await git.add(".");
    await git.commit(`commit on ${branch}`);
    if (pushTo) await git.push(pushTo, branch);
  }

  for (const tag of tags) {
    await git.addTag(tag);
    if (pushTo) await git.push(pushTo, tag);
  }
};

export const createLocalRepo = async (
  options: TestRepoOptions = {},
): Promise<string> => {
  const repoDir = options.dir ?? generateTmpDir();
  mkdirSync(repoDir, { recursive: true });

  const filesToWrite = options.files ?? { "initial.txt": "initial content\n" };

  await initGitRepo(repoDir);
  const git = createTestGitClient({ baseDir: repoDir });
  await git.addConfig("init.defaultBranch", "main");
  await git.checkout(["-b", "main"]);
  for (const [filename, content] of Object.entries(filesToWrite)) {
    writeFileSync(join(repoDir, filename), content);
  }
  await git.add(".");
  await git.commit("initial commit");
  await addRefsToRepo({ git, workDir: repoDir }, options);

  return repoDir;
};

export const createLocalBareRepo = async (
  options: TestRepoOptions = {},
): Promise<string> => {
  const bareRepoDir = options.dir ?? generateTmpDir();
  mkdirSync(bareRepoDir, { recursive: true });

  const { files } = options;

  await createTestGitClient({ baseDir: bareRepoDir }).init(true);

  const tmpWorkDir = join(bareRepoDir, "..", `tmp-work-${randomUUID()}`);
  mkdirSync(tmpWorkDir, { recursive: true });

  await initGitRepo(tmpWorkDir);
  const workGit = createTestGitClient({ baseDir: tmpWorkDir });
  await workGit.addConfig("init.defaultBranch", "main");
  await workGit.checkout(["-b", "main"]);

  const filesToWrite = files ?? { "initial.txt": "initial content\n" };
  for (const [filename, content] of Object.entries(filesToWrite)) {
    writeFileSync(join(tmpWorkDir, filename), content);
  }
  await workGit.add(".");
  await workGit.commit("initial commit");

  await workGit.addRemote("origin", bareRepoDir);
  await workGit.push(["-u", "origin", "main"]);

  await addRefsToRepo(
    { git: workGit, workDir: tmpWorkDir, pushTo: "origin" },
    options,
  );

  rmSync(tmpWorkDir, { recursive: true, force: true });

  return bareRepoDir;
};

export const commitFile = async (
  repoDir: string,
  filename: string,
  content: string,
  message = `Add ${filename}`,
): Promise<void> => {
  const filePath = join(repoDir, filename);
  await writeFile(filePath, content);
  const git = createTestGitClient({ baseDir: repoDir });
  await git.add(filename);
  await git.commit(message);
};

export const getCurrentBranch = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient({ baseDir: repoDir });
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
};

export const getCurrentCommit = async (repoDir: string): Promise<string> => {
  const git = createTestGitClient({ baseDir: repoDir });
  const commit = await git.revparse(["HEAD"]);
  return commit.trim();
};

export const getRefSha = async (
  repoDir: string,
  ref: string,
): Promise<string> => {
  const git = createTestGitClient({ baseDir: repoDir });
  const sha = await git.revparse([ref]);
  return sha.trim();
};
