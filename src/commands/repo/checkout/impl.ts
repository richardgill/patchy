import { simpleGit } from "simple-git";
import { resolveConfig } from "~/config/resolver";
import type { CheckoutCommandFlags, ResolvedConfig } from "~/config/types";
import type { LocalContext } from "~/context";
import { assertDefined } from "~/lib/assert";

const getCleanGitEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );

const gitClient = (repoDir: string) =>
  simpleGit({
    baseDir: repoDir,
    binary: "git",
    maxConcurrentProcesses: 6,
  }).env(getCleanGitEnv());

const isWorkingTreeDirty = async (repoDir: string): Promise<boolean> => {
  const git = gitClient(repoDir);
  const status = await git.status();
  return !status.isClean();
};

const isValidGitRef = async (
  repoDir: string,
  ref: string,
): Promise<boolean> => {
  const git = gitClient(repoDir);
  try {
    await git.revparse(["--verify", ref]);
    return true;
  } catch {
    return false;
  }
};

export default async function (
  this: LocalContext,
  flags: CheckoutCommandFlags,
): Promise<void> {
  const config = (await resolveConfig(this, flags, [
    "repo_base_dir",
    "repo_dir",
  ])) as ResolvedConfig;

  const repoDir = config.absoluteRepoDir;
  assertDefined(repoDir, "repo_dir");
  const ref = flags.ref;

  if (config.verbose) {
    this.process.stdout.write(`Checking out ref "${ref}" in ${repoDir}\n`);
  }

  if (await isWorkingTreeDirty(repoDir)) {
    this.process.stderr.write(
      `Error: Working tree in ${repoDir} has uncommitted changes.\n`,
    );
    this.process.stderr.write(
      "Please commit or stash your changes before checking out a different ref.\n",
    );
    this.process.exit?.(1);
    return;
  }

  if (!(await isValidGitRef(repoDir, ref))) {
    this.process.stderr.write(`Error: Invalid git ref "${ref}".\n`);
    this.process.stderr.write(
      "Please specify a valid branch, tag, or commit SHA.\n",
    );
    this.process.exit?.(1);
    return;
  }

  try {
    const git = gitClient(repoDir);
    await git.checkout(ref);
    this.process.stdout.write(`Successfully checked out "${ref}".\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.process.stderr.write(`Error checking out ref "${ref}": ${message}\n`);
    this.process.exit?.(1);
  }
}
