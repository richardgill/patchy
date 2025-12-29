import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { createGitClient, isGitRepo } from "~/lib/git";
import { canPrompt, createPrompts } from "~/lib/prompts";
import type { AutoCommitMode } from "./flags";

type CommitAction = "commit" | "prompt" | "skip";

const checkWorkingTreeClean = async (
  repoDir: string,
): Promise<{ clean: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { clean: true };
  }

  try {
    const git = createGitClient({ baseDir: repoDir });
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
  verbose: boolean,
): Promise<{ success: boolean; error?: string }> => {
  if (!isGitRepo(repoDir)) {
    return { success: true };
  }

  try {
    const git = createGitClient({ baseDir: repoDir });
    await git.add(".");
    await git.commit(`Apply patch set: ${patchSetName}`);
    const prefix = verbose ? "  " : " — ";
    stdout.write(`${prefix}committed ✓\n`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const determineCommitAction = (
  context: LocalContext,
  autoCommit: AutoCommitMode | undefined,
  isLastPatchSet: boolean,
): CommitAction => {
  const mode = autoCommit ?? "interactive";

  if (mode === "all") return "commit";
  if (mode === "off") return "skip";
  if (mode === "skip-last") return isLastPatchSet ? "skip" : "commit";
  // mode === "interactive"
  if (isLastPatchSet) return canPrompt(context) ? "prompt" : "commit";
  return "commit";
};

export const commitPatchSetIfNeeded = async (params: {
  context: LocalContext;
  repoDir: string;
  patchSetName: string;
  autoCommit: AutoCommitMode | undefined;
  verbose: boolean;
  isLastPatchSet: boolean;
  dryRun: boolean;
}): Promise<{ committed: boolean; cancelled?: boolean }> => {
  const {
    context,
    repoDir,
    patchSetName,
    autoCommit,
    verbose,
    isLastPatchSet,
    dryRun,
  } = params;
  if (dryRun) {
    return { committed: false };
  }

  const action = determineCommitAction(context, autoCommit, isLastPatchSet);

  if (action === "skip") {
    const prefix = verbose ? "  " : " — ";
    context.process.stdout.write(`${prefix}skipped\n`);
    return { committed: false };
  }

  if (action === "commit") {
    const result = await commitPatchSet(
      repoDir,
      patchSetName,
      context.process.stdout as NodeJS.WriteStream,
      verbose,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  const lineBreak = verbose ? "\n" : "\n\n";
  context.process.stdout.write(lineBreak);

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
      verbose,
    );
    if (!result.success) {
      exit(context, {
        exitCode: 1,
        stderr: `Could not commit patch set: ${result.error}`,
      });
    }
    return { committed: true };
  }

  return { committed: false };
};
