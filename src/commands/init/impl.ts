import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
import { formatPathForDisplay, isPathWithinDir, resolvePath } from "~/lib/fs";
import { extractRepoName, normalizeGitignoreEntry } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
import { isValidGitUrl, validateGitUrl } from "~/lib/validation";
import { getSchemaUrl } from "~/version";
import type { InitFlags } from "./flags";

type PromptAnswers = {
  patchesDir?: string;
  clonesDir?: string;
  addToGitignore?: boolean;
  repoUrl?: string;
  ref?: string;
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
    `\nNow you can edit your clone ${chalk.cyan(formatPathForDisplay(clonesDir))} and run ${chalk.cyan("patchy generate")} to generate patches\n`,
  );
};

export default async function (
  this: LocalContext,
  flags: InitFlags,
): Promise<void> {
  const configPath = resolve(this.cwd, flags.config ?? DEFAULT_CONFIG_PATH);

  if (!flags.force && existsSync(configPath)) {
    this.process.stderr.write(
      `Configuration file already exists at ${configPath}\n`,
    );
    this.process.stderr.write("Use --force to overwrite\n");
    this.process.exit?.(1);
    return;
  }

  if (flags["repo-url"] !== undefined) {
    if (!flags["repo-url"].trim()) {
      this.process.stderr.write("Repository URL is required\n");
      this.process.exit?.(1);
      return;
    }
    if (!isValidGitUrl(flags["repo-url"])) {
      this.process.stderr.write(
        "Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)\n",
      );
      this.process.exit?.(1);
      return;
    }
  }

  this.process.stdout.write("\n🔧 Let's set up your Patchy project\n\n");

  const answers: PromptAnswers = {};
  const prompts = createPrompts(this);

  if (flags["patches-dir"] === undefined) {
    const patchesDir = await prompts.text({
      message: "Path for patch files:",
      placeholder: "Where generated patch files will be stored",
      initialValue: getDefaultValue("patches_dir"),
    });
    if (prompts.isCancel(patchesDir)) {
      this.process.stderr.write("Initialization cancelled\n");
      this.process.exit?.(1);
      return;
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
      this.process.stderr.write("Initialization cancelled\n");
      this.process.exit?.(1);
      return;
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
        this.process.stderr.write("Initialization cancelled\n");
        this.process.exit?.(1);
        return;
      }
      answers.addToGitignore = addToGitignore;
    }
  }

  if (flags["repo-url"] === undefined) {
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
      this.process.stderr.write("Initialization cancelled\n");
      this.process.exit?.(1);
      return;
    }
    answers.repoUrl = repoUrl;
  }

  if (flags.ref === undefined) {
    const ref = await prompts.text({
      message: "Git ref to track:",
      placeholder: "Branch, tag, or commit to compare against",
      initialValue: getDefaultValue("ref"),
    });
    if (prompts.isCancel(ref)) {
      this.process.stderr.write("Initialization cancelled\n");
      this.process.exit?.(1);
      return;
    }
    answers.ref = ref;
  }

  const finalConfig: JsonConfig = {
    repo_url: flags["repo-url"] ?? answers.repoUrl ?? "",
    clones_dir: clonesDir,
    patches_dir:
      flags["patches-dir"] ??
      answers.patchesDir ??
      getDefaultValue("patches_dir") ??
      "",
    ref: flags.ref ?? answers.ref ?? getDefaultValue("ref") ?? "",
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
      this.process.stderr.write(
        `Failed to create patches directory: ${error}\n`,
      );
      this.process.exit?.(1);
      return;
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
      this.process.stderr.write(
        `Failed to create clones directory: ${error}\n`,
      );
      this.process.exit?.(1);
      return;
    }
  }

  if (answers.addToGitignore && clonesDir) {
    try {
      await addToGitignoreFile(this.cwd, clonesDir);
      prompts.log.step(
        `Added ${chalk.cyan(formatPathForDisplay(clonesDir))} to ${chalk.cyan(".gitignore")}`,
      );
    } catch (error) {
      this.process.stderr.write(`Failed to update .gitignore: ${error}\n`);
      this.process.exit?.(1);
      return;
    }
  }

  const jsonContent = await generateJsonConfig(finalConfig);

  try {
    await writeFile(configPath, jsonContent, "utf8");
    prompts.log.step(
      `Created configuration file: ${chalk.cyan(flags.config ?? DEFAULT_CONFIG_PATH)}`,
    );
  } catch (error) {
    this.process.stderr.write(
      `Failed to create configuration file: ${error}\n`,
    );
    this.process.exit?.(1);
    return;
  }

  prompts.outro(chalk.green("Patchy initialized successfully!"));

  await promptAndRunClone({
    clonesDir,
    repoUrl: finalConfig.repo_url ?? "",
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
