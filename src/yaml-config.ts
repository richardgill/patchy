import { readFileSync } from "node:fs";
import YAML from "yaml";
import { z } from "zod";

const baseConfigFields = {
  repo_url: z.string().min(1, "Repository URL is required"),
  repo_dir: z.string().min(1, "Repository directory is required"),
  repo_base_dir: z.string().min(1, "Repository base directory is required"),
  patches_dir: z.string().min(1, "Patches directory is required"),
  ref: z.string().min(1, "Git ref is required"),
};

export const requiredConfigSchema = z.object(baseConfigFields).strict();

export const optionalConfigSchema = z
  .object({
    repo_url: baseConfigFields.repo_url.optional(),
    repo_dir: baseConfigFields.repo_dir.optional(),
    repo_base_dir: baseConfigFields.repo_base_dir.optional(),
    patches_dir: baseConfigFields.patches_dir.optional(),
    ref: baseConfigFields.ref.optional(),
  })
  .strict();

export type RequiredConfigData = z.infer<typeof requiredConfigSchema>;
export type OptionalConfigData = z.infer<typeof optionalConfigSchema>;

export const parseYamlConfig = (filePath: string): RequiredConfigData => {
  const fileContent = readFileSync(filePath, "utf8");
  const parsedData = YAML.parse(fileContent);
  return requiredConfigSchema.parse(parsedData);
};
