export const isValidGitUrl = (url: string): boolean => {
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const sshPattern = /^git@[\w.-]+:[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const filePattern = /^file:\/\/\/.+$/;
  const absolutePathPattern = /^\/[^\s]+$/;
  const relativePathPattern = /^\.\.?\/[^\s]+$/;
  const trimmed = url.trim();
  return (
    httpsPattern.test(trimmed) ||
    sshPattern.test(trimmed) ||
    filePattern.test(trimmed) ||
    absolutePathPattern.test(trimmed) ||
    relativePathPattern.test(trimmed)
  );
};

export const validateGitUrl = (url: string): string | true => {
  if (!url.trim()) return "Repository URL is required";
  if (!isValidGitUrl(url))
    return "Please enter a valid Git URL (https://github.com/owner/repo, git@github.com:owner/repo.git, or /path/to/local/repo)";
  return true;
};
