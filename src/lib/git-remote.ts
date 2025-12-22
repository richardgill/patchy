import { partition } from "es-toolkit";
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

  return result
    .split("\n")
    .filter(Boolean)
    .flatMap((line): RemoteRef[] => {
      const [sha, ref] = line.split("\t");
      if (ref.startsWith("refs/heads/")) {
        return [{ sha, name: ref.replace("refs/heads/", ""), type: "branch" }];
      }
      if (ref.startsWith("refs/tags/")) {
        return [{ sha, name: ref.replace("refs/tags/", ""), type: "tag" }];
      }
      return [];
    });
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

export const MANUAL_SHA_OPTION = "_manual";

type BaseRevisionOption = {
  value: string;
  label: string;
};

export const buildBaseRevisionOptions = (
  tags: RemoteRef[],
  branches: RemoteRef[],
  options?: { branchLimit?: number; manualLabel?: string },
): BaseRevisionOption[] => {
  const branchLimit = options?.branchLimit ?? 3;
  const manualLabel = options?.manualLabel ?? "Enter SHA or tag manually";

  return [
    ...tags.map((t) => ({
      value: t.sha,
      label: `${t.name} (${t.sha.slice(0, 7)})`,
    })),
    ...branches.slice(0, branchLimit).map((b) => ({
      value: b.sha,
      label: `${b.name} branch tip (${b.sha.slice(0, 7)}) - Warning: will change`,
    })),
    { value: MANUAL_SHA_OPTION, label: manualLabel },
  ];
};

export const NONE_UPSTREAM_VALUE = "_none";

type UpstreamBranchOption = {
  value: string;
  label: string;
};

export const buildUpstreamBranchOptions = (
  branches: RemoteRef[],
): UpstreamBranchOption[] => {
  const [primaryBranches, otherBranches] = partition(
    branches,
    (b) => b.name === "main" || b.name === "master",
  );

  return [
    ...primaryBranches.map((b) => ({ value: b.name, label: b.name })),
    { value: NONE_UPSTREAM_VALUE, label: "None (manual updates only)" },
    ...otherBranches.map((b) => ({ value: b.name, label: b.name })),
  ];
};

export const filterBranchesForBaseRevision = (
  branches: RemoteRef[],
  selectedUpstream: string | undefined,
): RemoteRef[] => {
  if (!selectedUpstream) {
    return branches;
  }
  return branches.filter((b) => b.name === selectedUpstream);
};
