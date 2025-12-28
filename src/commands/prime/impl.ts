import { basename, join, resolve } from "node:path";
import { DEFAULT_CONFIG_PATH } from "~/cli-fields";
import type { LocalContext } from "~/context";
import { loadJsonConfig } from "~/lib/cli-config";
import { exit } from "~/lib/exit";
import {
  formatPathForDisplay,
  getSortedFolders,
  stripTrailingSlashes,
} from "~/lib/fs";
import type { PrimeFlags } from "./flags";

type PrimeConfig = {
  configPath: string;
  patchesDir: string;
  absolutePatchesDir: string;
  clonesDir: string;
  repoName: string;
  sourceRepo: string | undefined;
  baseRevision: string;
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
  const patchesDir = config.patches_dir ?? "patches";

  return {
    configPath: relativePath,
    patchesDir,
    absolutePatchesDir: resolve(context.cwd, patchesDir),
    clonesDir: config.clones_dir ?? "clones",
    repoName,
    sourceRepo: config.source_repo,
    baseRevision: config.base_revision ?? "main",
  };
};

const extractRepoName = (sourceRepo: string): string => {
  if (!sourceRepo) return "<repo-name>";
  const name = basename(sourceRepo.replace(/\.git$/, ""));
  return name || "<repo-name>";
};

const formatPatchSets = (patchSets: string[]): string => {
  if (patchSets.length === 0) {
    return "  (none yet)\n";
  }
  return patchSets.map((name) => `  - \`${name}/\`\n`).join("");
};

const generateOutput = (config: PrimeConfig): string => {
  const {
    configPath,
    patchesDir,
    absolutePatchesDir,
    clonesDir,
    repoName,
    sourceRepo,
    baseRevision,
  } = config;
  const targetPath = formatPathForDisplay(join(clonesDir, repoName));
  const normalizedPatchesDir = formatPathForDisplay(
    stripTrailingSlashes(patchesDir),
  );
  const patchSets = getSortedFolders(absolutePatchesDir);

  const sourceRepoLine = sourceRepo ? `- Source: \`${sourceRepo}\`\n` : "";

  return `## Patchy

This project uses \`patchy\` to maintain patches against an upstream repo.

${sourceRepoLine}- Base revision: \`${baseRevision}\`
- Config: \`${formatPathForDisplay(configPath)}\`
- Patches: \`${normalizedPatchesDir}/\`
- Cloned repo: \`${targetPath}/\`

Patch sets:
${formatPatchSets(patchSets)}
Key commands:
- \`patchy generate --patch-set <name>\` - Generate patches from cloned repo changes
- \`patchy apply --auto-commit all\` - Apply all patches to the cloned repo
- \`patchy repo reset --yes\` - Reset cloned repo to base revision (discard all changes)

Make changes in \`${targetPath}/\`, then run \`patchy generate --patch-set <name>\` to update patches.
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
