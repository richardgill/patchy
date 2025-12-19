import { simpleGit } from "simple-git";

export type RemoteRef = {
  sha: string;
  name: string;
  type: "branch" | "tag";
};

export const fetchRemoteRefs = async (
  repoUrl: string,
): Promise<RemoteRef[]> => {
  const git = simpleGit();
  const result = await git.listRemote(["--refs", repoUrl]);

  const refs: RemoteRef[] = [];
  for (const line of result.split("\n").filter(Boolean)) {
    const [sha, ref] = line.split("\t");
    if (ref.startsWith("refs/heads/")) {
      refs.push({
        sha,
        name: ref.replace("refs/heads/", ""),
        type: "branch",
      });
    } else if (ref.startsWith("refs/tags/")) {
      refs.push({
        sha,
        name: ref.replace("refs/tags/", ""),
        type: "tag",
      });
    }
  }

  return refs;
};

export const getLatestTags = (refs: RemoteRef[], limit = 10): RemoteRef[] => {
  return refs
    .filter((r) => r.type === "tag")
    .slice(-limit)
    .reverse();
};

export const getBranches = (refs: RemoteRef[]): RemoteRef[] => {
  return refs.filter((r) => r.type === "branch");
};
