import { readFileSync } from "node:fs";
import YAML from "yaml";
import {
  type RequiredConfigData,
  requiredConfigSchema,
  type YamlConfig,
  yamlConfigSchema,
} from "./schemas";

export const parseYamlConfig = (filePath: string): RequiredConfigData => {
  const fileContent = readFileSync(filePath, "utf8");
  const parsedData = YAML.parse(fileContent);
  return requiredConfigSchema.parse(parsedData);
};

export const parseOptionalYamlConfig = (filePath: string): YamlConfig => {
  const fileContent = readFileSync(filePath, "utf8");
  const parsedData = YAML.parse(fileContent);
  const { data, success, error } = yamlConfigSchema.safeParse(parsedData);
  if (success) {
    return data;
  }
  // todo human format
  throw error;
};
