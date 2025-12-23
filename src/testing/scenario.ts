import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestGitClient } from "~/lib/git";
import { runCli as baseRunCli } from "./e2e-utils";
import { generateTmpDir, writeFileIn } from "./fs-test-utils";
import {
  createLocalBareRepo,
  initGitRepo,
  initGitRepoWithCommit,
} from "./git-helpers";
import {
  acceptDefault,
  cancel,
  type PromptedCliResult,
  type PromptInfo,
  type PromptResponse,
  type RecordedPrompt,
} from "./prompt-testing-types";
import type { FileMap } from "./testing-types";

export { acceptDefault, cancel };

type BareRepoOptions = {
  tags?: string[];
  branches?: string[];
  files?: FileMap;
};

type ScenarioOptions = {
  patches?: Record<string, FileMap>;
  targetFiles?: FileMap;
  git?: boolean;
  bareRepo?: boolean | BareRepoOptions;
  config?: Record<string, string | boolean | number>;
  rawConfig?: Record<string, unknown>;
  noConfig?: boolean;
  configPath?: string;
  configContent?: string;
  tty?: boolean;
  env?: Record<string, string>;
};

type PromptMatcher = string | RegExp;

type PromptExpectation = {
  confirm?: PromptMatcher;
  text?: PromptMatcher;
  select?: PromptMatcher;
  respond: PromptResponse;
};

type ScenarioContext = {
  runCli: (command: string) => Promise<PromptedCliResult>;
  fileContent: (relativePath: string) => string;
  exists: (relativePath: string) => boolean;
  commits: () => Promise<string[]>;
  gitStatus: () => Promise<string[]>;
  config: () => Record<string, unknown>;
  patchFile: (relativePath: string) => string;
  patchExists: (relativePath: string) => boolean;
  tmpDir: string;
  withPrompts: (...prompts: PromptExpectation[]) => ScenarioContext;
};

const DEFAULT_CONFIG = {
  source_repo: "https://github.com/example/test-repo.git",
  clones_dir: "repos",
  target_repo: "main",
  patches_dir: "patches",
};

const matchesPattern = (message: string, pattern: PromptMatcher): boolean => {
  if (typeof pattern === "string") {
    return message.includes(pattern);
  }
  return pattern.test(message);
};

const findResponse = (
  prompt: PromptInfo,
  expectations: PromptExpectation[],
): PromptResponse => {
  for (const expectation of expectations) {
    const hasConfirm =
      "confirm" in expectation && expectation.confirm !== undefined;
    const hasText = "text" in expectation && expectation.text !== undefined;
    const hasSelect =
      "select" in expectation && expectation.select !== undefined;

    if (
      hasConfirm &&
      prompt.type === "confirm" &&
      matchesPattern(prompt.message, expectation.confirm as PromptMatcher)
    ) {
      return expectation.respond;
    }
    if (
      hasText &&
      prompt.type === "text" &&
      matchesPattern(prompt.message, expectation.text as PromptMatcher)
    ) {
      return expectation.respond;
    }
    if (
      hasSelect &&
      prompt.type === "select" &&
      matchesPattern(prompt.message, expectation.select as PromptMatcher)
    ) {
      return expectation.respond;
    }
  }
  throw new Error(
    `Unhandled prompt: ${JSON.stringify(prompt)}\n` +
      `Registered expectations: ${expectations.map((e) => JSON.stringify(e)).join(", ")}`,
  );
};

type ScenarioPaths = {
  tmpDir: string;
  patchesDir: string;
  clonesDir: string;
  targetRepoDir: string;
  bareRepoDir: string;
};

const setupDirectories = async (tmpDir: string): Promise<ScenarioPaths> => {
  const patchesDir = join(tmpDir, "patches");
  const clonesDir = join(tmpDir, "repos");
  const targetRepoDir = join(clonesDir, "main");
  const bareRepoDir = join(tmpDir, "bare-repo.git");

  await mkdir(tmpDir, { recursive: true });
  await mkdir(patchesDir, { recursive: true });
  await mkdir(clonesDir, { recursive: true });
  await mkdir(targetRepoDir, { recursive: true });

  return { tmpDir, patchesDir, clonesDir, targetRepoDir, bareRepoDir };
};

const setupBareRepo = async (
  bareRepoDir: string,
  bareRepoOption: boolean | BareRepoOptions,
): Promise<void> => {
  await mkdir(bareRepoDir, { recursive: true });
  const bareOpts = typeof bareRepoOption === "object" ? bareRepoOption : {};
  await createLocalBareRepo({
    dir: bareRepoDir,
    files: bareOpts.files,
    branches: bareOpts.branches,
    tags: bareOpts.tags,
  });
};

const setupConfig = async (
  tmpDir: string,
  bareRepoDir: string,
  options: ScenarioOptions,
): Promise<void> => {
  const configFilename = options.configPath ?? "patchy.json";
  const content =
    options.configContent ??
    JSON.stringify(
      options.rawConfig ?? {
        ...DEFAULT_CONFIG,
        ...(options.bareRepo ? { source_repo: `file://${bareRepoDir}` } : {}),
        ...options.config,
      },
      null,
      2,
    );
  await writeFile(join(tmpDir, configFilename), content);
};

const setupPatches = async (
  patchesDir: string,
  patches: Record<string, FileMap>,
): Promise<void> => {
  for (const [patchSetName, files] of Object.entries(patches)) {
    for (const [filename, content] of Object.entries(files)) {
      await writeFileIn(patchesDir, join(patchSetName, filename), content);
    }
  }
};

const setupTargetFiles = async (
  targetRepoDir: string,
  targetFiles: FileMap,
): Promise<void> => {
  for (const [filename, content] of Object.entries(targetFiles)) {
    await writeFileIn(targetRepoDir, filename, content);
  }
};

const setupGit = async (
  targetRepoDir: string,
  hasTargetFiles: boolean,
): Promise<void> => {
  if (hasTargetFiles) {
    await initGitRepo(targetRepoDir);
    const git = createTestGitClient({ baseDir: targetRepoDir });
    await git.addConfig("init.defaultBranch", "main");
    await git.checkout(["-b", "main"]);
    await git.add(".");
    await git.commit("initial commit");
  } else {
    await initGitRepoWithCommit(targetRepoDir);
  }
};

const createContextHelpers = (
  paths: ScenarioPaths,
): Pick<
  ScenarioContext,
  | "fileContent"
  | "exists"
  | "commits"
  | "gitStatus"
  | "config"
  | "patchFile"
  | "patchExists"
  | "tmpDir"
> => {
  const { tmpDir, patchesDir, targetRepoDir } = paths;

  const fileContent = (relativePath: string): string => {
    const fullPath = join(targetRepoDir, relativePath);
    return readFileSync(fullPath, "utf-8");
  };

  const exists = (relativePath: string): boolean => {
    const fullPath = join(targetRepoDir, relativePath);
    return existsSync(fullPath);
  };

  const commits = async (): Promise<string[]> => {
    const git = createTestGitClient({ baseDir: targetRepoDir });
    const log = await git.log();
    return log.all.map((commit) => commit.message);
  };

  const gitStatus = async (): Promise<string[]> => {
    const git = createTestGitClient({ baseDir: targetRepoDir });
    const status = await git.status();
    return status.files.map((f) => f.path);
  };

  const config = (): Record<string, unknown> => {
    const configPath = join(tmpDir, "patchy.json");
    return JSON.parse(readFileSync(configPath, "utf-8"));
  };

  const patchFile = (relativePath: string): string => {
    const fullPath = join(patchesDir, relativePath);
    return readFileSync(fullPath, "utf-8");
  };

  const patchExists = (relativePath: string): boolean => {
    const fullPath = join(patchesDir, relativePath);
    return existsSync(fullPath);
  };

  return {
    fileContent,
    exists,
    commits,
    gitStatus,
    config,
    patchFile,
    patchExists,
    tmpDir,
  };
};

const createRunCli = (
  tmpDir: string,
  expectations: PromptExpectation[],
  ttyMode: boolean,
  env?: Record<string, string>,
): ((command: string) => Promise<PromptedCliResult>) => {
  return async (command: string): Promise<PromptedCliResult> => {
    const recorded: RecordedPrompt[] = [];

    if (!ttyMode) {
      const result = await baseRunCli(command, tmpDir, { env });
      return { result, prompts: recorded };
    }

    const result = await baseRunCli(command, tmpDir, {
      promptHandler: (prompt) => findResponse(prompt, expectations),
      onPromptRecord: (p) => recorded.push(p),
      env,
    });
    return { result, prompts: recorded };
  };
};

export const scenario = async (
  options: ScenarioOptions = {},
): Promise<ScenarioContext> => {
  const paths = await setupDirectories(generateTmpDir());

  if (options.bareRepo) {
    await setupBareRepo(paths.bareRepoDir, options.bareRepo);
  }

  if (!options.noConfig) {
    await setupConfig(paths.tmpDir, paths.bareRepoDir, options);
  }

  if (options.patches) {
    await setupPatches(paths.patchesDir, options.patches);
  }

  if (options.targetFiles) {
    await setupTargetFiles(paths.targetRepoDir, options.targetFiles);
  }

  if (options.git) {
    const hasTargetFiles = Boolean(
      options.targetFiles && Object.keys(options.targetFiles).length > 0,
    );
    await setupGit(paths.targetRepoDir, hasTargetFiles);
  }

  const helpers = createContextHelpers(paths);

  const withPrompts = (
    ...expectations: PromptExpectation[]
  ): ScenarioContext => {
    return {
      ...helpers,
      runCli: createRunCli(paths.tmpDir, expectations, true, options.env),
      withPrompts,
    };
  };

  return {
    ...helpers,
    runCli: createRunCli(paths.tmpDir, [], options.tty ?? false, options.env),
    withPrompts,
  };
};
