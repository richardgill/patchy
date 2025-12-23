import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { createPrompts } from "~/lib/prompts";
import { loadConfig, writeConfigUpdate } from "./config";
import type { BaseFlags } from "./flags";
import { canRunInteractive, promptForBaseRevision } from "./interactive";
import { fetchAndValidateRemoteRefs } from "./remote";

export default async function (
  this: LocalContext,
  flags: BaseFlags,
  newBaseRevision?: string,
): Promise<void> {
  const config = loadConfig(this, flags);

  if (newBaseRevision !== undefined) {
    if (flags.verbose) {
      this.process.stdout.write(
        `Current base_revision: ${config.currentBase}\n`,
      );
      this.process.stdout.write(`New base_revision: ${newBaseRevision}\n`);
    }
    await writeConfigUpdate(
      this,
      config.configPath,
      config.content,
      newBaseRevision,
    );
    return;
  }

  const interactiveCheck = canRunInteractive(this, config);
  if (!interactiveCheck.canRun) {
    this.process.stdout.write(`Current base_revision: ${config.currentBase}\n`);
    if (interactiveCheck.isError) {
      return exit(this, { exitCode: 1, stderr: interactiveCheck.message });
    }
    this.process.stdout.write(`${interactiveCheck.message}\n`);
    return;
  }

  const prompts = createPrompts(this);
  const remoteRefs = await fetchAndValidateRemoteRefs(
    this,
    prompts,
    config.sourceRepo,
  );
  if (!remoteRefs) return;

  const newBase = await promptForBaseRevision(
    this,
    prompts,
    remoteRefs,
    config.currentBase,
  );
  if (!newBase) return;

  if (flags.verbose) {
    this.process.stdout.write(
      `\nCurrent base_revision: ${config.currentBase}\n`,
    );
    this.process.stdout.write(`New base_revision: ${newBase}\n\n`);
  }

  await writeConfigUpdate(
    this,
    config.configPath,
    config.content,
    newBase,
    prompts,
  );
}
