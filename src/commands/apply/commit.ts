import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { createGitClient, isGitRepo } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
import type { ApplyFlags } from "./flags";

type CommitMode = "auto" | "prompt" | "skip";

const checkWorkingTreeClean = async (
  repoDir: string,
): Promise<{ clean: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { clean: true };
  }

  try {
    const git = createGitClient(repoDir);
    const status = await git.status();

    if (status.files.length > 0) {
      return {
        clean: false,
        error:
          "Working tree is dirty. Please commit or stash changes before applying patches.",
      };
    }

    return { clean: true };
  } catch (error) {
    return {
      clean: false,
      error: `Failed to check working tree status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const ensureCleanWorkingTree = async (
  context: LocalContext,
  repoDir: string,
): Promise<void> => {
  const result = await checkWorkingTreeClean(repoDir);
  if (!result.clean && result.error) {
    exit(context, { exitCode: 1, stderr: result.error });
  }
};

const commitPatchSet = async (
  repoDir: string,
  patchSetName: string,
  stdout: NodeJS.WriteStream,
): Promise<{ success: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { success: true };
  }

  try {
    const git = createGitClient(repoDir);
    await git.add(".");
    await git.commit(`Apply patch set: ${patchSetName}`);
    stdout.write(`  Committed patch set: ${patchSetName}\n`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const determineCommitMode = (
  context: LocalContext,
  flags: ApplyFlags,
  isLastPatchSet: boolean,
): CommitMode => {
  if (flags.all) {
    return "auto";
  }

  if (flags.edit) {
    return isLastPatchSet ? "skip" : "auto";
  }

  if (isLastPatchSet) {
    return canPrompt(context) ? "prompt" : "auto";
  }

  return "auto";
};

export const commitPatchSetIfNeeded = async (params: {
  context: LocalContext;
  repoDir: string;
  patchSetName: string;
  flags: ApplyFlags;
  isLastPatchSet: boolean;
  dryRun: boolean;
  hasErrors: boolean;
}): Promise<{ committed: boolean; cancelled?: boolean }> => {
  const {
    context,
    repoDir,
    patchSetName,
    flags,
    isLastPatchSet,
    dryRun,
    hasErrors,
  } = params;
  if (dryRun || hasErrors) {
    return { committed: false };
  }

  const mode = determineCommitMode(context, flags, isLastPatchSet);

  if (mode === "skip") {
    context.process.stdout.write(
      `  Left patch set uncommitted: ${patchSetName}\n`,
    );
    return { committed: false };
  }

  if (mode === "auto") {
    const result = await commitPatchSet(
      repoDir,
      patchSetName,
      context.process.stdout as NodeJS.WriteStream,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  const prompts = createPrompts(context);
  const shouldCommit = await prompts.confirm({
    message: `Commit changes from patch set "${patchSetName}"?`,
    initialValue: true,
  });

  if (prompts.isCancel(shouldCommit)) {
    context.process.stderr.write("Apply cancelled\n");
    return { committed: false, cancelled: true };
  }

  if (shouldCommit) {
    const result = await commitPatchSet(
      repoDir,
      patchSetName,
      context.process.stdout as NodeJS.WriteStream,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  context.process.stdout.write(
    `  Left patch set uncommitted: ${patchSetName}\n`,
  );
  return { committed: false };
};
