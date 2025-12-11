import type { ZodError } from "zod";

export const formatZodErrorHuman = (error: ZodError): string => {
  if (error.issues.length === 0) {
    return error.message;
  }

  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("\n");
};
