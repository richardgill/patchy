export const isValidGitUrl = (url: string): boolean => {
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const sshPattern = /^git@[\w.-]+:[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const trimmed = url.trim();
  return httpsPattern.test(trimmed) || sshPattern.test(trimmed);
};

export const validateGitUrl = (url: string): string | true => {
  if (!url.trim()) return "Repository URL is required";
  if (!isValidGitUrl(url))
    return "Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)";
  return true;
};
