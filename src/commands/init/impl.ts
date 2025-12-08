import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as prompts from "@clack/prompts";
import { omitBy } from "es-toolkit";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_PATCHES_DIR,
  DEFAULT_REF,
} from "~/config/defaults";
import {
  type RequiredConfigData,
  requiredConfigSchema,
} from "~/config/schemas";
import { isValidGitUrl } from "~/config/validation";
import type { LocalContext } from "~/context";

const handleCancel = <T>(
  value: T | symbol,
  process: LocalContext["process"],
): value is symbol => {
  if (prompts.isCancel(value)) {
    prompts.cancel("Initialization cancelled");
    process.exit?.(1);
    return true;
  }
  return false;
};

type InitCommandFlags = {
  "repo-url"?: string;
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

  prompts.intro("Let's set up your Patchy project");

  const answers: PromptAnswers = {};

  if (flags["repo-url"] === undefined) {
    const repoUrl = await prompts.text({
      message: "Upstream repository URL:",
      placeholder: "https://github.com/owner/repo",
      validate: (value) => {
        if (!value.trim()) return "Repository URL is required";
        if (!isValidGitUrl(value))
          return "Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)";
        return undefined;
      },
    });
    if (handleCancel(repoUrl, this.process)) return;
    answers.repoUrl = repoUrl;
  }

  if (flags.ref === undefined) {
    const ref = await prompts.text({
      message: "Git ref to track:",
      placeholder: "Branch, tag, or commit to compare against",
      initialValue: DEFAULT_REF,
    });
    if (handleCancel(ref, this.process)) return;
    answers.ref = ref;
  }

  if (flags["patches-dir"] === undefined) {
    const patchesDir = await prompts.text({
      message: "Path for patch files:",
      placeholder: "Where generated patch files will be stored",
      initialValue: DEFAULT_PATCHES_DIR,
    });
    if (handleCancel(patchesDir, this.process)) return;
    answers.patchesDir = patchesDir;
  }

  const repoUrl = flags["repo-url"] ?? answers.repoUrl ?? "";

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

  const jsonContent = generateJsonConfig(finalConfig);

  try {
    await writeFile(configPath, jsonContent, "utf8");
    this.process.stdout.write(`Created configuration file: ${configPath}\n`);
  } catch (error) {
    this.process.stderr.write(
      `Failed to create configuration file: ${error}\n`,
    );
    this.process.exit?.(1);
    return;
  }

  prompts.outro("Patchy project initialized successfully!");

  this.process.stdout.write("\nNext steps:\n");
  this.process.stdout.write(
    `1. Clone your upstream repository: patchy repo clone --repo-url ${finalConfig.repo_url}\n`,
  );
  this.process.stdout.write(`2. Make changes to your repository\n`);
  this.process.stdout.write(`3. Generate patches: patchy generate\n`);
}

const generateJsonConfig = (config: RequiredConfigData): string => {
  const validatedConfig = requiredConfigSchema.parse(config);

  const jsonData = omitBy(
    validatedConfig,
    (value, key) =>
      value === "" || value == null || (key === "verbose" && value === false),
  );

  return `${JSON.stringify(jsonData, null, 2)}\n`;
};
