import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "@stricli/core";
import chalk from "chalk";
import { omitBy } from "es-toolkit";
import { app } from "~/app";
import {
  DEFAULT_CONFIG_PATH,
  getDefaultValue,
  type JsonConfig,
  jsonConfigSchema,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay, isPathWithinDir, resolvePath } from "~/lib/fs";
import { extractRepoName, normalizeGitignoreEntry } from "~/lib/git";
import {
  buildBaseRevisionOptions,
  fetchRemoteRefs,
  getBranches,
  getLatestTags,
  MANUAL_SHA_OPTION,
} from "~/lib/git-remote";
import { canPrompt, createPrompts, promptForManualSha } from "~/lib/prompts";
import { isValidGitUrl, validateGitUrl } from "~/lib/validation";
import { getSchemaUrl } from "~/version";
import type { InitFlags } from "./flags";

type PromptAnswers = {
  patchesDir?: string;
  clonesDir?: string;
  addToGitignore?: boolean;
  repoUrl?: string;
  baseRevision?: string;
  upstreamBranch?: string;
};

type PromptCloneParams = {
  clonesDir: string;
  repoUrl: string;
  context: LocalContext;
};

const promptAndRunClone = async ({
  clonesDir,
  repoUrl,
  context,
}: PromptCloneParams): Promise<void> => {
  const repoName = extractRepoName(repoUrl) ?? "repository";

  if (!canPrompt(context)) {
    context.process.stdout.write(
      `\nRun ${chalk.cyan("patchy repo clone")} to clone ${chalk.cyan(repoName)} into ${chalk.cyan(formatPathForDisplay(clonesDir))}\n`,
    );
    return;
  }

  const prompts = createPrompts(context);
  const shouldClone = await prompts.confirm({
    message: `Clone ${chalk.cyan(repoName)} into ${chalk.cyan(formatPathForDisplay(clonesDir))} now?`,
    initialValue: true,
  });

  if (prompts.isCancel(shouldClone) || !shouldClone) {
    context.process.stdout.write(
      `\nRun ${chalk.cyan("patchy repo clone")} when you're ready to clone your repo into ${chalk.cyan(formatPathForDisplay(clonesDir))}\n`,
    );
    return;
  }

  context.process.stdout.write("\n");
  await run(app, ["repo", "clone"], context);

  context.process.stdout.write(
    `\nNow you can edit your clone ${chalk.cyan(formatPathForDisplay(join(clonesDir, repoName)))} and run ${chalk.cyan("patchy generate")} to generate patches\n`,
  );
};

export default async function (
  this: LocalContext,
  flags: InitFlags,
): Promise<void> {
  const configPath = resolve(this.cwd, flags.config ?? DEFAULT_CONFIG_PATH);

  if (!flags.force && existsSync(configPath)) {
    return exit(this, {
      exitCode: 1,
      stderr: `Configuration file already exists at ${configPath}\nUse --force to overwrite`,
    });
  }

  if (flags["source-repo"] !== undefined) {
    if (!flags["source-repo"].trim()) {
      return exit(this, { exitCode: 1, stderr: "Repository URL is required" });
    }
    if (!isValidGitUrl(flags["source-repo"])) {
      return exit(this, {
        exitCode: 1,
        stderr:
          "Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)",
      });
    }
  }

  this.process.stdout.write("\n🔧 Setting up patch in this directory\n\n");

  const answers: PromptAnswers = {};
  const prompts = createPrompts(this);

  if (flags["patches-dir"] === undefined) {
    const patchesDir = await prompts.text({
      message: "Path for patch files:",
      placeholder: "Where generated patch files will be stored",
      initialValue: getDefaultValue("patches_dir"),
    });
    if (prompts.isCancel(patchesDir)) {
      return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
    }
    answers.patchesDir = patchesDir;
  }

  if (flags["clones-dir"] === undefined) {
    const clonesDir = await prompts.text({
      message: "Directory for cloned repos:",
      placeholder: "Parent directory where upstream repos are cloned",
      initialValue: getDefaultValue("clones_dir"),
    });
    if (prompts.isCancel(clonesDir)) {
      return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
    }
    answers.clonesDir = clonesDir;
  }

  const clonesDir =
    flags["clones-dir"] ??
    answers.clonesDir ??
    getDefaultValue("clones_dir") ??
    "";

  const clonesDirWithinCwd = clonesDir && isPathWithinDir(this.cwd, clonesDir);

  if (flags.gitignore !== undefined) {
    answers.addToGitignore = flags.gitignore && Boolean(clonesDirWithinCwd);
  } else {
    const isInteractive = flags["clones-dir"] === undefined;
    if (isInteractive && clonesDirWithinCwd) {
      const addToGitignore = await prompts.confirm({
        message: `Add ${formatPathForDisplay(clonesDir)} to .gitignore?`,
        initialValue: true,
      });
      if (prompts.isCancel(addToGitignore)) {
        return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
      }
      answers.addToGitignore = addToGitignore;
    }
  }

  if (flags["source-repo"] === undefined) {
    const repoUrl = await prompts.text({
      message: "Upstream repository URL:",
      placeholder: "https://github.com/example/repo",
      validate: (url) => {
        if (!url) return "Repository URL is required";
        const result = validateGitUrl(url);
        return result === true ? undefined : result;
      },
    });
    if (prompts.isCancel(repoUrl)) {
      return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
    }
    answers.repoUrl = repoUrl;
  }

  const repoUrl = flags["source-repo"] ?? answers.repoUrl ?? "";

  let remoteRefs: Awaited<ReturnType<typeof fetchRemoteRefs>> = [];
  const shouldFetchRemote =
    repoUrl &&
    (flags["upstream-branch"] === undefined ||
      flags["base-revision"] === undefined);

  if (shouldFetchRemote && canPrompt(this)) {
    try {
      prompts.log.step("Fetching repository information...");
      remoteRefs = await fetchRemoteRefs(repoUrl);
    } catch (_error) {
      prompts.log.warn(
        "Could not fetch remote refs. You can enter values manually.",
      );
    }
  }

  if (flags["upstream-branch"] === undefined && remoteRefs.length > 0) {
    const branches = getBranches(remoteRefs);
    const NONE_VALUE = "_none";
    const branchOptions: Array<{ value: string; label: string }> = [
      { value: NONE_VALUE, label: "None (manual updates only)" },
      ...branches.map((b) => ({ value: b.name, label: b.name })),
    ];

    const selectedBranch = await prompts.select({
      message: "Select upstream branch to track:",
      options: branchOptions,
    });

    if (prompts.isCancel(selectedBranch)) {
      return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
    }

    answers.upstreamBranch =
      selectedBranch === NONE_VALUE ? undefined : selectedBranch;
  }

  if (flags["base-revision"] === undefined) {
    if (remoteRefs.length > 0) {
      const tags = getLatestTags(remoteRefs);
      const branches = getBranches(remoteRefs);
      const baseOptions = buildBaseRevisionOptions(tags, branches, {
        manualLabel: "Enter SHA manually",
      });

      const selectedBase = await prompts.select({
        message: "Select base revision:",
        options: baseOptions,
      });

      if (prompts.isCancel(selectedBase)) {
        return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
      }

      if (selectedBase === MANUAL_SHA_OPTION) {
        const manualSha = await promptForManualSha(prompts);
        if (prompts.isCancel(manualSha)) {
          return exit(this, {
            exitCode: 1,
            stderr: "Initialization cancelled",
          });
        }
        answers.baseRevision = manualSha;
      } else {
        answers.baseRevision = selectedBase;
      }
    } else {
      const baseRevision = await prompts.text({
        message: "Base revision (SHA or tag):",
        placeholder: "Git ref to pin the base to",
        initialValue: getDefaultValue("base_revision"),
      });
      if (prompts.isCancel(baseRevision)) {
        return exit(this, { exitCode: 1, stderr: "Initialization cancelled" });
      }
      answers.baseRevision = baseRevision;
    }
  }

  const finalConfig: JsonConfig = {
    source_repo: flags["source-repo"] ?? answers.repoUrl ?? "",
    clones_dir: clonesDir,
    patches_dir:
      flags["patches-dir"] ??
      answers.patchesDir ??
      getDefaultValue("patches_dir") ??
      "",
    base_revision:
      flags["base-revision"] ??
      answers.baseRevision ??
      getDefaultValue("base_revision") ??
      "",
    ...(flags["upstream-branch"] !== undefined
      ? { upstream_branch: flags["upstream-branch"] }
      : answers.upstreamBranch !== undefined
        ? { upstream_branch: answers.upstreamBranch }
        : {}),
  };

  const absolutePatchesDir = resolvePath(
    this.cwd,
    finalConfig.patches_dir ?? "",
  );
  if (finalConfig.patches_dir) {
    try {
      await mkdir(absolutePatchesDir, { recursive: true });
      prompts.log.step(
        `Created patches directory: ${chalk.cyan(formatPathForDisplay(finalConfig.patches_dir ?? ""))}`,
      );
    } catch (error) {
      return exit(this, {
        exitCode: 1,
        stderr: `Failed to create patches directory: ${error}`,
      });
    }
  }

  const absoluteClonesDir = resolvePath(this.cwd, clonesDir);
  if (clonesDir) {
    try {
      await mkdir(absoluteClonesDir, { recursive: true });
      prompts.log.step(
        `Created clones directory: ${chalk.cyan(formatPathForDisplay(clonesDir))}`,
      );
    } catch (error) {
      return exit(this, {
        exitCode: 1,
        stderr: `Failed to create clones directory: ${error}`,
      });
    }
  }

  if (answers.addToGitignore && clonesDir) {
    try {
      await addToGitignoreFile(this.cwd, clonesDir);
      prompts.log.step(
        `Added ${chalk.cyan(formatPathForDisplay(clonesDir))} to ${chalk.cyan(".gitignore")}`,
      );
    } catch (error) {
      return exit(this, {
        exitCode: 1,
        stderr: `Failed to update .gitignore: ${error}`,
      });
    }
  }

  const jsonContent = await generateJsonConfig(finalConfig);

  try {
    await writeFile(configPath, jsonContent, "utf8");
    prompts.log.step(
      `Created configuration file: ${chalk.cyan(flags.config ?? DEFAULT_CONFIG_PATH)}`,
    );
  } catch (error) {
    return exit(this, {
      exitCode: 1,
      stderr: `Failed to create configuration file: ${error}`,
    });
  }

  prompts.outro(chalk.green("Patchy initialized successfully!"));

  await promptAndRunClone({
    clonesDir,
    repoUrl: finalConfig.source_repo ?? "",
    context: this,
  });
}

const addToGitignoreFile = async (
  cwd: string,
  entry: string,
): Promise<void> => {
  const gitignorePath = resolve(cwd, ".gitignore");
  const normalizedEntry = normalizeGitignoreEntry(entry);

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    const lines = content.split("\n");
    const hasEntry = lines.some(
      (line) => line === normalizedEntry || line === entry,
    );
    if (hasEntry) {
      return;
    }
    const needsSeparator = content.length > 0 && !content.endsWith("\n");
    const separator = needsSeparator ? "\n" : "";
    await appendFile(gitignorePath, `${separator}${normalizedEntry}\n`);
  } else {
    await writeFile(gitignorePath, `${normalizedEntry}\n`);
  }
};

const generateJsonConfig = async (config: JsonConfig): Promise<string> => {
  const validatedConfig = jsonConfigSchema.parse(config);

  const cleanedConfig = omitBy(
    validatedConfig,
    (value, key) =>
      value === "" ||
      value == null ||
      key === "$schema" ||
      (key === "verbose" && value === false),
  );

  const jsonData = {
    $schema: await getSchemaUrl(),
    ...cleanedConfig,
  };

  return `${JSON.stringify(jsonData, null, 2)}\n`;
};
