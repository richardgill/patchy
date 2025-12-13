export const isValidGitUrl = (url: string): boolean => {
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const sshPattern = /^git@[\w.-]+:[\w.-]+(\/[\w.-]+)+(\.git)?$/;
  const filePattern = /^file:\/\/\/.+$/;
  const trimmed = url.trim();
  return (
    httpsPattern.test(trimmed) ||
    sshPattern.test(trimmed) ||
    filePattern.test(trimmed)
  );
};

export const validateGitUrl = (url: string): string | true => {
  if (!url.trim()) return "Repository URL is required";
  if (!isValidGitUrl(url))
    return "Please enter a valid Git URL (https://github.com/owner/repo or git@github.com:owner/repo.git)";
  return true;
};

export const validatePath = (path: string, name: string): string | true => {
  if (!path.trim()) return `${name} is required`;
  return true;
};

export const validateRef = (ref: string): string | true => {
  if (!ref.trim()) return "Git ref is required";
  return true;
};
