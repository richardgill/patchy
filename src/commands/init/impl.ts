import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import enquirer from "enquirer";
import { compact, omitBy } from "es-toolkit";
import { stringify } from "yaml";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "../../config/defaults";
import { isValidGitUrl, validateGitUrl } from "../../config/validation";
import type { LocalContext } from "../../context";
import {
  type RequiredConfigData,
  requiredConfigSchema,
} from "../../yaml-config";

const { prompt } = enquirer;

type InitCommandFlags = {
  repoUrl?: string;
  "repo-dir"?: string;
  "repo-base-dir"?: string;
  "patches-dir"?: string;
  ref?: string;
  config?: string;
  force?: boolean;
};

type PromptAnswers = {
  repoUrl?: string;
  repoDir?: string;
  repoBaseDir?: string;
  patchesDir?: string;
  ref?: string;
};

export default async function (
  this: LocalContext,
  flags: InitCommandFlags,
): Promise<void> {
  const configPath = resolve(flags.config ?? DEFAULT_CONFIG_PATH);

  if (!flags.force && existsSync(configPath)) {
    this.process.stderr.write(
      `Configuration file already exists at ${configPath}\n`,
    );
    this.process.stderr.write("Use --force to overwrite\n");
    this.process.exit?.(1);
    return;
  }

  if (flags.repoUrl !== undefined) {
    if (!flags.repoUrl.trim()) {
      this.process.stderr.write("Repository URL is required\n");
      this.process.exit?.(1);
      return;
    }
    if (!isValidGitUrl(flags.repoUrl)) {
      this.process.stderr.write(
        "Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)\n",
      );
      this.process.exit?.(1);
      return;
    }
  }

  this.process.stdout.write("\n🔧 Let's set up your Patchy project\n\n");

  const questions = compact([
    flags.repoUrl === undefined && {
      type: "input",
      name: "repoUrl",
      message: "Upstream repository URL:",
      hint: "e.g. https://github.com/owner/repo",
      validate: validateGitUrl,
    },
    flags.ref === undefined && {
      type: "input",
      name: "ref",
      message: "Git ref to track:",
      hint: "Branch, tag, or commit to compare against",
      initial: DEFAULT_REF,
    },
    flags["patches-dir"] === undefined && {
      type: "input",
      name: "patchesDir",
      message: "Path for patch files:",
      hint: "Where generated patch files will be stored",
      initial: DEFAULT_PATCHES_DIR,
    },
  ]);

  const answers: PromptAnswers =
    questions.length > 0
      ? await prompt<PromptAnswers>(questions).catch(() => {
          this.process.stderr.write("Initialization cancelled\n");
          this.process.exit?.(1);
          return {} as PromptAnswers;
        })
      : {};

  const repoUrl = flags.repoUrl ?? answers.repoUrl ?? "";

  const finalConfig: RequiredConfigData = {
    repo_url: repoUrl,
    repo_dir: flags["repo-dir"] ?? "",
    repo_base_dir: flags["repo-base-dir"] ?? "",
    patches_dir:
      flags["patches-dir"] ?? answers.patchesDir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? answers.ref ?? DEFAULT_REF,
    verbose: false,
  };

  try {
    await mkdir(finalConfig.patches_dir, { recursive: true });
    this.process.stdout.write(
      `Created patches directory: ${finalConfig.patches_dir}\n`,
    );
  } catch (error) {
    this.process.stderr.write(`Failed to create patches directory: ${error}\n`);
    this.process.exit?.(1);
    return;
  }

  const yamlContent = generateYamlConfig(finalConfig);

  try {
    await writeFile(configPath, yamlContent, "utf8");
    this.process.stdout.write(`Created configuration file: ${configPath}\n`);
  } catch (error) {
    this.process.stderr.write(
      `Failed to create configuration file: ${error}\n`,
    );
    this.process.exit?.(1);
    return;
  }

  this.process.stdout.write("\n✅ Patchy project initialized successfully!\n");
  this.process.stdout.write("\nNext steps:\n");
  this.process.stdout.write(
    `1. Clone your upstream repository: patchy repo clone --repo-url ${finalConfig.repo_url}\n`,
  );
  this.process.stdout.write(`2. Make changes to your repository\n`);
  this.process.stdout.write(`3. Generate patches: patchy generate\n`);
}

const generateYamlConfig = (config: RequiredConfigData): string => {
  const validatedConfig = requiredConfigSchema.parse(config);

  const yamlData = omitBy(
    validatedConfig,
    (value, key) =>
      value === "" || value == null || (key === "verbose" && value === false),
  );

  return stringify(yamlData);
};
