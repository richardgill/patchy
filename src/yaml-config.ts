import { z } from "zod";

export const configSchema = z.object({
  repoUrl: z.string().min(1, "Repository URL is required"),
  repoDir: z.string().min(1, "Repository directory is required"),
  repoBaseDir: z.string().min(1, "Repository base directory is required"),
  patchesDir: z.string().min(1, "Patches directory is required"),
  ref: z.string().min(1, "Git ref is required"),
});

export type ConfigData = z.infer<typeof configSchema>;
