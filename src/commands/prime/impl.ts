import { basename, join } from "node:path";
import { DEFAULT_CONFIG_PATH } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { loadJsonConfig } from "~/lib/cli-config";
import { exit } from "~/lib/exit";
import { formatPathForDisplay, stripTrailingSlashes } from "~/lib/fs";
import type { PrimeFlags } from "./flags";

type PrimeConfig = {
  configPath: string;
  patchesDir: string;
  clonesDir: string;
  repoName: string;
};

const loadConfig = (context: LocalContext, flags: PrimeFlags): PrimeConfig => {
  const result = loadJsonConfig(context.cwd, flags.config);

  if (!result.success) {
    return exit(context, { exitCode: 1, stderr: result.error });
  }

  const { config } = result;
  const repoName =
    config.target_repo ?? extractRepoName(config.source_repo ?? "");
  const relativePath = flags.config ?? DEFAULT_CONFIG_PATH;

  return {
    configPath: relativePath,
    patchesDir: config.patches_dir ?? "patches",
    clonesDir: config.clones_dir ?? "clones",
    repoName,
  };
};

const extractRepoName = (sourceRepo: string): string => {
  if (!sourceRepo) return "<repo-name>";
  const name = basename(sourceRepo.replace(/\.git$/, ""));
  return name || "<repo-name>";
};

const generateOutput = (config: PrimeConfig): string => {
  const { configPath, patchesDir, clonesDir, repoName } = config;
  const targetPath = formatPathForDisplay(join(clonesDir, repoName));
  const normalizedPatchesDir = formatPathForDisplay(
    stripTrailingSlashes(patchesDir),
  );

  return `## Patchy

This project uses \`patchy\` to maintain patches against an upstream repo.

- Config: \`${formatPathForDisplay(configPath)}\` (jsonc)
- Patches: \`${normalizedPatchesDir}/\`
- Cloned repo: \`${targetPath}/\`

Key commands:
- \`patchy generate\` - Generate patches from changes in the cloned repo
- \`patchy apply\` - Apply all patches to the cloned repo
- \`patchy repo reset\` - Reset cloned repo to base revision (discard all changes)

Make changes in \`${targetPath}/\`, then run \`patchy generate\` to update patches.
`;
};

export default async function (
  this: LocalContext,
  flags: PrimeFlags,
): Promise<void> {
  const config = loadConfig(this, flags);
  const output = generateOutput(config);
  this.process.stdout.write(output);
}
