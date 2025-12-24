import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestGitClient } from "~/lib/git";
import { generateTmpDir } from "./fs-test-utils";
import type { FileMap } from "./testing-types";

const TEMPLATE_DIR = join(import.meta.dir, "../../e2e/tmp/.templates");
const TEMPLATE_BARE_REPO = join(TEMPLATE_DIR, "bare-template.git");
const TEMPLATE_LOCAL_REPO = join(TEMPLATE_DIR, "local-template");

const createTemplateBareRepo = async (): Promise<void> => {
  mkdirSync(TEMPLATE_BARE_REPO, { recursive: true });
  await createTestGitClient({ baseDir: TEMPLATE_BARE_REPO }).init(true);
};

const createTemplateLocalRepo = async (): Promise<void> => {
  mkdirSync(TEMPLATE_LOCAL_REPO, { recursive: true });
  const git = createTestGitClient({ baseDir: TEMPLATE_LOCAL_REPO });
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test User");
  await git.addConfig("init.defaultBranch", "main");
  await git.checkout(["-b", "main"]);
  writeFileSync(join(TEMPLATE_LOCAL_REPO, "initial.txt"), "initial content\n");
  await git.add(".");
  await git.commit("initial commit");
  await git.addRemote("origin", TEMPLATE_BARE_REPO);
  await git.push(["-u", "origin", "main"]);
};

export const createTemplateRepos = async (): Promise<void> => {
  rmSync(TEMPLATE_DIR, { recursive: true, force: true });
  await createTemplateBareRepo();
  await createTemplateLocalRepo();
};

export const createLocalBareRepo = async (
  options: TestRepoOptions = {},
): Promise<string> => {
  const bareRepoDir = options.dir ?? generateTmpDir();

  mkdirSync(bareRepoDir, { recursive: true });
  cpSync(TEMPLATE_BARE_REPO, bareRepoDir, { recursive: true });

  const { files, branches = [], tags = [] } = options;
  const needsWork = files || branches.length > 0 || tags.length > 0;
  if (!needsWork) {
    return bareRepoDir;
  }

  const tmpWorkDir = join(bareRepoDir, "..", `tmp-work-${randomUUID()}`);
  mkdirSync(tmpWorkDir, { recursive: true });

  const git = createTestGitClient({ baseDir: tmpWorkDir });
  await git.clone(bareRepoDir, ".");

  if (files) {
    for (const [filename, content] of Object.entries(files)) {
      writeFileSync(join(tmpWorkDir, filename), content);
    }
    await git.add(".");
    await git.commit("add custom files");
    await git.push("origin", "main");
  }

  await addRefsToRepo(
    { git, workDir: tmpWorkDir, pushTo: "origin" },
    { branches, tags },
  );

  rmSync(tmpWorkDir, { recursive: true, force: true });
  return bareRepoDir;
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
  cpSync(TEMPLATE_LOCAL_REPO, repoDir, { recursive: true });

  const { files, commits = 0, branches = [], tags = [] } = options;
  const needsWork =
    files || commits > 0 || branches.length > 0 || tags.length > 0;
  if (!needsWork) {
    return repoDir;
  }

  const git = createTestGitClient({ baseDir: repoDir });

  if (files) {
    for (const [filename, content] of Object.entries(files)) {
      writeFileSync(join(repoDir, filename), content);
    }
    await git.add(".");
    await git.commit("add custom files");
  }

  await addRefsToRepo({ git, workDir: repoDir }, { commits, branches, tags });

  return repoDir;
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
