import type { LocalContext } from "~/context";
import { exit } from "~/lib/exit";
import { getSortedFolders } from "~/lib/fs";
import { canPrompt, createPrompts } from "~/lib/prompts";

export const CREATE_NEW_OPTION = "_create_new";

const getNextPatchSetPrefix = (patchesDir: string): string => {
  const folders = getSortedFolders(patchesDir);
  const prefixes = folders.map((name) => {
    const match = name.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxPrefix = prefixes.length > 0 ? Math.max(...prefixes) : 0;
  return String(maxPrefix + 1).padStart(3, "0");
};

export const resolvePatchSet = async (
  context: LocalContext,
  absolutePatchesDir: string,
  configPatchSet: string | undefined,
): Promise<string | undefined> => {
  if (configPatchSet) {
    return configPatchSet;
  }

  const existingPatchSets = getSortedFolders(absolutePatchesDir);

  if (!canPrompt(context)) {
    return exit(context, {
      exitCode: 1,
      stderr:
        "No patch set specified. Use --patch-set, PATCHY_PATCH_SET env var, or set patch_set in config.",
    });
  }

  const prompts = createPrompts(context);

  if (existingPatchSets.length === 0) {
    const name = await prompts.text({
      message: "New patch set name:",
      placeholder: "e.g., security-fixes",
      validate: (input) => (input?.trim() ? undefined : "Name is required"),
    });
    if (prompts.isCancel(name)) {
      return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
    }
    const prefix = getNextPatchSetPrefix(absolutePatchesDir);
    return `${prefix}-${name}`;
  }

  const options: Array<{ value: string; label: string }> = [
    { value: CREATE_NEW_OPTION, label: "Create new patch set" },
    ...existingPatchSets
      .toReversed()
      .map((name) => ({ value: name, label: name })),
  ];

  const selected = await prompts.select({
    message: "Select patch set:",
    options,
  });

  if (prompts.isCancel(selected)) {
    return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
  }

  if (selected === CREATE_NEW_OPTION) {
    const name = await prompts.text({
      message: "New patch set name:",
      placeholder: "e.g., security-fixes",
      validate: (input) => (input?.trim() ? undefined : "Name is required"),
    });
    if (prompts.isCancel(name)) {
      return exit(context, { exitCode: 1, stderr: "Operation cancelled" });
    }
    const prefix = getNextPatchSetPrefix(absolutePatchesDir);
    return `${prefix}-${name}`;
  }

  return selected as string;
};
