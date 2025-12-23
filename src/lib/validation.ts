export const isLocalPath = (url: string): boolean => {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("file://")
  );
};

const HTTPS_PATTERN = /^https?:\/\/[\w.-]+\/[\w.-]+(\/[\w.-]+)+(\.git)?$/;
const SSH_PATTERN = /^git@[\w.-]+:[\w.-]+(\/[\w.-]+)+(\.git)?$/;
const FILE_PATTERN = /^file:\/\/\/.+$/;
const ABSOLUTE_PATH_PATTERN = /^\/[^\s]+$/;
const RELATIVE_PATH_PATTERN = /^\.\.?\/[^\s]+$/;

export const isValidGitUrl = (url: string): boolean => {
  const trimmed = url.trim();
  return (
    HTTPS_PATTERN.test(trimmed) ||
    SSH_PATTERN.test(trimmed) ||
    FILE_PATTERN.test(trimmed) ||
    ABSOLUTE_PATH_PATTERN.test(trimmed) ||
    RELATIVE_PATH_PATTERN.test(trimmed)
  );
};

export const validateGitUrl = (url: string): string | true => {
  if (!url.trim()) return "Repository URL is required";
  if (!isValidGitUrl(url))
    return "Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)";
  return true;
};
