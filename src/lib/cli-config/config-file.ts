import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_CONFIG_PATH,
  type JsonConfig,
  jsonConfigSchema,
} from "~/cli-fields";
import { parseJsonc } from "~/lib/jsonc";

type LoadSuccess = {
  success: true;
  config: JsonConfig;
  configPath: string;
  content: string;
};
type LoadFailure = { success: false; error: string };
type LoadResult = LoadSuccess | LoadFailure;

export const loadJsonConfig = (
  cwd: string,
  configFlag?: string,
): LoadResult => {
  const relativePath = configFlag ?? DEFAULT_CONFIG_PATH;
  const configPath = resolve(cwd, relativePath);

  if (!existsSync(configPath)) {
    return {
      success: false,
      error: `Configuration file not found: ${configPath}`,
    };
  }

  const content = readFileSync(configPath, "utf8");
  const parseResult = parseJsonc<JsonConfig>(content);

  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  const zodResult = jsonConfigSchema.safeParse(parseResult.json);
  if (!zodResult.success) {
    return { success: false, error: "Invalid configuration file" };
  }

  return { success: true, config: zodResult.data, configPath, content };
};
