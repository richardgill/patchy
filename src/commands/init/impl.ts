import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import enquirer from "enquirer";
import { compact } from "es-toolkit";
import { stringify } from "yaml";
import type { LocalContext } from "../../context.js";
import { type ConfigData, configSchema } from "../../yaml-config.js";

const { prompt } = enquirer;

const DEFAULT_PATCHES_DIR = "./patches/";
const DEFAULT_CONFIG_PATH = "./patchy.yaml";
const DEFAULT_REF = "main";

type InitCommandFlags = {
  repoUrl?: string;
  repoDir?: string;
  repoBaseDir?: string;
  patchesDir?: string;
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
  const patchesDir = resolve(flags.patchesDir ?? DEFAULT_PATCHES_DIR);

  if (!flags.force && existsSync(configPath)) {
    this.process.stderr.write(
      `Configuration file already exists at ${configPath}\n`,
    );
    this.process.stderr.write("Use --force to overwrite\n");
    this.process.exit?.(1);
    return;
  }

  const questions = compact([
    !flags.repoUrl && {
      type: "input",
      name: "repoUrl",
      message: "Enter the upstream repository URL:",
      validate: (input: string) =>
        input.trim() !== "" || "Repository URL is required",
    },
    !flags.repoDir && {
      type: "input",
      name: "repoDir",
      message: "Enter the path to the Git repo you're patching:",
      validate: (input: string) =>
        input.trim() !== "" || "Repository directory is required",
    },
    !flags.repoBaseDir && {
      type: "input",
      name: "repoBaseDir",
      message: "Enter the parent directory for cloned repos:",
      validate: (input: string) =>
        input.trim() !== "" || "Repository base directory is required",
    },
    !flags.patchesDir && {
      type: "input",
      name: "patchesDir",
      message: "Enter the path for patch files:",
      initial: DEFAULT_PATCHES_DIR,
    },
    !flags.ref && {
      type: "input",
      name: "ref",
      message: "Enter the Git ref to use:",
      initial: DEFAULT_REF,
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

  const finalConfig: ConfigData = {
    repoUrl: flags.repoUrl ?? answers.repoUrl ?? "",
    repoDir: flags.repoDir ?? answers.repoDir ?? "",
    repoBaseDir: flags.repoBaseDir ?? answers.repoBaseDir ?? "",
    patchesDir: flags.patchesDir ?? answers.patchesDir ?? DEFAULT_PATCHES_DIR,
    ref: flags.ref ?? answers.ref ?? DEFAULT_REF,
  };

  try {
    await mkdir(patchesDir, { recursive: true });
    this.process.stdout.write(`Created patches directory: ${patchesDir}\n`);
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
    `1. Clone your upstream repository: patchy repo clone --repo-url ${finalConfig.repoUrl}\n`,
  );
  this.process.stdout.write(
    `2. Make changes to your repository in ${finalConfig.repoDir}\n`,
  );
  this.process.stdout.write(`3. Generate patches: patchy generate\n`);
}

const generateYamlConfig = (config: ConfigData): string => {
  const validatedConfig = configSchema.parse(config);

  const yamlData = {
    repo_url: validatedConfig.repoUrl,
    repo_dir: validatedConfig.repoDir,
    repo_base_dir: validatedConfig.repoBaseDir,
    patches_dir: validatedConfig.patchesDir,
    ref: validatedConfig.ref,
  };

  return stringify(yamlData);
};
