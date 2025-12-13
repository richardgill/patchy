import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as prompts from "@clack/prompts";
import chalk from "chalk";
import { omitBy } from "es-toolkit";
import {
  DEFAULT_CONFIG_PATH,
  getDefaultValue,
  type JsonConfig,
  jsonConfigSchema,
} from "~/cli-fields";
import type { LocalContext } from "~/context";
import { isValidGitUrl, validateGitUrl } from "~/lib/validation";
import { getSchemaUrl } from "~/version";
import type { InitFlags } from "./flags";

type PromptAnswers = {
  patchesDir?: string;
  repoBaseDir?: string;
  addToGitignore?: boolean;
  repoUrl?: string;
  ref?: string;
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

  if (flags["repo-base-dir"] === undefined) {
    const repoBaseDir = await prompts.text({
      message: "Directory for upstream repos:",
      placeholder: "Parent directory where upstream repos are cloned",
      initialValue: getDefaultValue("repo_base_dir"),
    });
    if (prompts.isCancel(repoBaseDir)) {
      this.process.stderr.write("Initialization cancelled\n");
      this.process.exit?.(1);
      return;
    }
    answers.repoBaseDir = repoBaseDir;
  }

  const repoBaseDir =
    flags["repo-base-dir"] ??
    answers.repoBaseDir ??
    getDefaultValue("repo_base_dir") ??
    "";

  if (flags.gitignore !== undefined) {
    answers.addToGitignore = flags.gitignore;
  } else {
    const isInteractive = flags["repo-base-dir"] === undefined;
    if (isInteractive && repoBaseDir) {
      const addToGitignore = await prompts.confirm({
        message: `Add ${repoBaseDir} to .gitignore?`,
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
    repo_base_dir: repoBaseDir,
    patches_dir:
      flags["patches-dir"] ??
      answers.patchesDir ??
      getDefaultValue("patches_dir") ??
      "",
    ref: flags.ref ?? answers.ref ?? getDefaultValue("ref") ?? "",
  };

  const absolutePatchesDir = resolve(this.cwd, finalConfig.patches_dir ?? "");
  if (finalConfig.patches_dir) {
    try {
      await mkdir(absolutePatchesDir, { recursive: true });
      prompts.log.step(
        `Created patches directory: ${chalk.cyan(finalConfig.patches_dir)}`,
      );
    } catch (error) {
      this.process.stderr.write(
        `Failed to create patches directory: ${error}\n`,
      );
      this.process.exit?.(1);
      return;
    }
  }

  const absoluteRepoBaseDir = resolve(this.cwd, repoBaseDir);
  if (repoBaseDir) {
    try {
      await mkdir(absoluteRepoBaseDir, { recursive: true });
      prompts.log.step(
        `Created upstream directory: ${chalk.cyan(repoBaseDir)}`,
      );
    } catch (error) {
      this.process.stderr.write(
        `Failed to create upstream directory: ${error}\n`,
      );
      this.process.exit?.(1);
      return;
    }
  }

  if (answers.addToGitignore && repoBaseDir) {
    try {
      await addToGitignoreFile(this.cwd, repoBaseDir);
      prompts.log.step(
        `Added ${chalk.cyan(repoBaseDir)} to ${chalk.cyan(".gitignore")}`,
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
  this.process.stdout.write(
    `\nRun ${chalk.cyan("patchy repo clone")} to clone your repo into ${chalk.cyan(repoBaseDir)}\n`,
  );
}

const addToGitignoreFile = async (
  cwd: string,
  entry: string,
): Promise<void> => {
  const gitignorePath = resolve(cwd, ".gitignore");
  const normalizedEntry = entry.endsWith("/") ? entry : `${entry}/`;

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
