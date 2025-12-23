import chalk from "chalk";
import { getDefaultValue } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { createPrompts } from "~/lib/prompts";
import { buildFinalConfig, validatePreConditions } from "./config";
import type { InitFlags } from "./flags";
import { gatherAnswers } from "./prompts";
import { createDirectoriesAndFiles, promptAndRunClone } from "./setup";

export default async function (
  this: LocalContext,
  flags: InitFlags,
): Promise<void> {
  await validatePreConditions(this, flags);

  this.process.stdout.write("\n🔧 Setting up patch in this directory\n\n");

  const answers = await gatherAnswers(this, flags);
  const config = buildFinalConfig(
    flags,
    answers,
    getDefaultValue("clones_dir") ?? "",
  );

  await createDirectoriesAndFiles(
    this,
    flags,
    config,
    answers.addToGitignore ?? false,
  );

  const prompts = createPrompts(this);
  prompts.outro(chalk.green("Patchy initialized successfully!"));

  await promptAndRunClone(
    this,
    config.clones_dir ?? "",
    config.source_repo ?? "",
  );
}
