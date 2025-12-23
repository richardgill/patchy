import chalk from "chalk";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import {
  buildBaseRevisionOptions,
  getBranches,
  getLatestTags,
  MANUAL_SHA_OPTION,
} from "~/lib/git-remote";
import { canPrompt, type Prompts, promptForManualSha } from "~/lib/prompts";
import type { BaseConfig } from "./config";
import type { RemoteRefs } from "./remote";

type InteractiveCheck =
  | { canRun: true }
  | { canRun: false; isError: false; message: string }
  | { canRun: false; isError: true; message: string };

export const canRunInteractive = (
  context: LocalContext,
  config: BaseConfig,
): InteractiveCheck => {
  if (!canPrompt(context)) {
    return {
      canRun: false,
      isError: false,
      message:
        "Interactive mode requires a TTY. Use direct mode: patchy base <revision>",
    };
  }

  if (!config.upstreamBranch) {
    return {
      canRun: false,
      isError: true,
      message: chalk.red(
        "upstream_branch is required for interactive mode. Set it in your config or use direct mode: patchy base <revision>",
      ),
    };
  }

  if (!config.sourceRepo) {
    return {
      canRun: false,
      isError: true,
      message: chalk.red("source_repo is required to fetch upstream refs"),
    };
  }

  return { canRun: true };
};

export const promptForBaseRevision = async (
  context: LocalContext,
  prompts: Prompts,
  remoteRefs: RemoteRefs,
  currentBase: string,
): Promise<string | undefined> => {
  const tags = getLatestTags(remoteRefs, 10);
  const branches = getBranches(remoteRefs);
  const baseOptions = buildBaseRevisionOptions(tags, branches);

  const selectedBase = await prompts.select({
    message: `Select new base revision (current: ${currentBase}):`,
    options: baseOptions,
  });

  if (prompts.isCancel(selectedBase)) {
    return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
  }

  if (selectedBase === MANUAL_SHA_OPTION) {
    const manualSha = await promptForManualSha(prompts);
    if (prompts.isCancel(manualSha)) {
      return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
    }
    return manualSha;
  }

  return selectedBase;
};
