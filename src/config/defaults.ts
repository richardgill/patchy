import { homedir } from "node:os";
import { resolve } from "node:path";

export const DEFAULT_PATCHES_DIR = "./patches/";
export const DEFAULT_CONFIG_PATH = "./patchy.yaml";
export const DEFAULT_REF = "main";
export const DEFAULT_REPO_BASE_DIR = resolve(homedir(), ".patchy/repos");
