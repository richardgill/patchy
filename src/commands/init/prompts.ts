import { getDefaultValue } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { formatPathForDisplay, isPathWithinDir } from "~/lib/fs";
import {
  buildBaseRevisionOptions,
  fetchRefs,
  getBranches,
  getLatestTags,
  MANUAL_SHA_OPTION,
  type RemoteRef,
} from "~/lib/git-remote";
import { canPrompt, createPrompts, promptForManualSha } from "~/lib/prompts";
import { validateGitUrl } from "~/lib/validation";
import type { PromptAnswers } from "./config";
import type { InitFlags } from "./flags";

const fetchRemoteRefsIfNeeded = async (
  context: LocalContext,
  repoUrl: string,
  flags: InitFlags,
): Promise<RemoteRef[]> => {
  const shouldFetchRemote =
    repoUrl &&
    (flags["upstream-branch"] === undefined ||
      flags["base-revision"] === undefined);

  if (!shouldFetchRemote || !canPrompt(context)) {
    return [];
  }

  const prompts = createPrompts(context);
  try {
    prompts.log.step("Fetching repository information...");
    return await fetchRefs(repoUrl, context.cwd);
  } catch {
    prompts.log.warn(
      "Could not fetch remote refs. You can enter values manually.",
    );
    return [];
  }
};

const promptUpstreamBranch = async (
  context: LocalContext,
  remoteRefs: RemoteRef[],
): Promise<string | undefined> => {
  if (remoteRefs.length === 0) {
    return undefined;
  }

  const prompts = createPrompts(context);
  const branches = getBranches(remoteRefs);
  const branchNames = branches.map((b) => b.name);
  const preferredBranch =
    branchNames.find((n) => n === "main") ??
    branchNames.find((n) => n === "master") ??
    branchNames[0];
  const otherBranches = branchNames.filter((n) => n !== preferredBranch);

  const NONE_VALUE = "_none";
  const branchOptions: Array<{ value: string; label: string }> = [
    ...(preferredBranch
      ? [{ value: preferredBranch, label: preferredBranch }]
      : []),
    { value: NONE_VALUE, label: "None (manual updates only)" },
    ...otherBranches.map((name) => ({ value: name, label: name })),
  ];

  const selectedBranch = await prompts.select({
    message: "Select upstream branch to track:",
    options: branchOptions,
  });

  if (prompts.isCancel(selectedBranch)) {
    return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
  }

  return selectedBranch === NONE_VALUE ? undefined : selectedBranch;
};

const promptBaseRevision = async (
  context: LocalContext,
  remoteRefs: RemoteRef[],
): Promise<string> => {
  const prompts = createPrompts(context);

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
      return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
    }

    if (selectedBase === MANUAL_SHA_OPTION) {
      const manualSha = await promptForManualSha(prompts);
      if (prompts.isCancel(manualSha)) {
        return exit(context, {
          exitCode: 1,
          stderr: "Initialization cancelled",
        });
      }
      return manualSha;
    }

    return selectedBase;
  }

  const baseRevision = await prompts.text({
    message: "Base revision (SHA or tag):",
    placeholder: "Git ref to pin the base to",
    initialValue: getDefaultValue("base_revision"),
  });
  if (prompts.isCancel(baseRevision)) {
    return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
  }
  return baseRevision;
};

export const gatherAnswers = async (
  context: LocalContext,
  flags: InitFlags,
): Promise<PromptAnswers> => {
  const answers: PromptAnswers = {};
  const prompts = createPrompts(context);

  if (flags["patches-dir"] === undefined) {
    const patchesDir = await prompts.text({
      message: "Path for patch files:",
      placeholder: "Where generated patch files will be stored",
      initialValue: getDefaultValue("patches_dir"),
    });
    if (prompts.isCancel(patchesDir)) {
      return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
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
      return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
    }
    answers.clonesDir = clonesDir;
  }

  const clonesDir =
    flags["clones-dir"] ??
    answers.clonesDir ??
    getDefaultValue("clones_dir") ??
    "";

  const clonesDirWithinCwd =
    clonesDir && isPathWithinDir(context.cwd, clonesDir);

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
        return exit(context, {
          exitCode: 1,
          stderr: "Initialization cancelled",
        });
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
      return exit(context, { exitCode: 1, stderr: "Initialization cancelled" });
    }
    answers.repoUrl = repoUrl;
  }

  const repoUrl = flags["source-repo"] ?? answers.repoUrl ?? "";
  const remoteRefs = await fetchRemoteRefsIfNeeded(context, repoUrl, flags);

  if (flags["upstream-branch"] === undefined && remoteRefs.length > 0) {
    answers.upstreamBranch = await promptUpstreamBranch(context, remoteRefs);
  }

  if (flags["base-revision"] === undefined) {
    answers.baseRevision = await promptBaseRevision(context, remoteRefs);
  }

  return answers;
};
