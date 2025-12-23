import chalk from "chalk";
import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { fetchRemoteRefs } from "~/lib/git-remote";
import type { Prompts } from "~/lib/prompts";

export type RemoteRefs = Awaited<ReturnType<typeof fetchRemoteRefs>>;

export const fetchAndValidateRemoteRefs = async (
  context: LocalContext,
  prompts: Prompts,
  sourceRepo: string,
): Promise<RemoteRefs | undefined> => {
  prompts.log.step(`Fetching upstream refs from ${chalk.cyan(sourceRepo)}...`);

  try {
    return await fetchRemoteRefs(sourceRepo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return exit(context, {
      exitCode: 1,
      stderr: chalk.red(`Failed to fetch remote refs: ${message}`),
    });
  }
};
