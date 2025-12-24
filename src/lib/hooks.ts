import { spawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { join } from "node:path";
import type { LocalContext } from "~/context";

type HookType = "pre-apply" | "post-apply";

export type HookEnv = {
  PATCHY_TARGET_REPO: string;
  PATCHY_PATCH_SET: string;
  PATCHY_PATCHES_DIR: string;
  PATCHY_PATCH_SET_DIR: string;
  PATCHY_BASE_REVISION?: string;
};

export type HookInfo = {
  path: string;
  name: string;
  type: HookType;
};

type HookResult = { success: true } | { success: false; error: string };

export const getHookFilename = (prefix: string, type: HookType): string =>
  `${prefix}${type}`;

type FindHookParams = {
  dir: string;
  prefix: string;
  type: HookType;
};

export const findHook = (params: FindHookParams): HookInfo | undefined => {
  const { dir, prefix, type } = params;
  const filename = getHookFilename(prefix, type);
  const hookPath = join(dir, filename);

  if (!existsSync(hookPath)) {
    return undefined;
  }

  return {
    path: hookPath,
    name: filename,
    type,
  };
};

export const isExecutable = (filePath: string): boolean => {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

type ValidateHookParams = {
  hook: HookInfo;
  patchSetName: string;
  patchSetDir: string;
};

export const validateHookPermissions = (
  params: ValidateHookParams,
): HookResult => {
  const { hook, patchSetName, patchSetDir } = params;
  if (!isExecutable(hook.path)) {
    const relativePath = `${patchSetDir}/${hook.name}`;
    return {
      success: false,
      error:
        `Hook '${hook.name}' in patch set '${patchSetName}' is not executable.\n` +
        `Run: chmod +x ${relativePath}`,
    };
  }
  return { success: true };
};

type ExecuteHookParams = {
  hook: HookInfo;
  cwd: string;
  env: HookEnv;
  context: LocalContext;
};

export const executeHook = async (
  params: ExecuteHookParams,
): Promise<HookResult> => {
  const { hook, cwd, env, context } = params;
  return new Promise((resolve) => {
    const child = spawn(hook.path, [], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line) {
          context.process.stdout.write(`    ${line}\n`);
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line) {
          context.process.stderr.write(`    ${line}\n`);
        }
      }
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ success: true });
      } else if (signal) {
        resolve({
          success: false,
          error: `Hook '${hook.name}' was killed by signal ${signal}.`,
        });
      } else {
        resolve({
          success: false,
          error: `Hook '${hook.name}' failed with exit code ${code}.`,
        });
      }
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        error: `Hook '${hook.name}' failed to execute: ${err.message}`,
      });
    });
  });
};

export const getHookFilenames = (prefix: string): string[] => [
  getHookFilename(prefix, "pre-apply"),
  getHookFilename(prefix, "post-apply"),
];
