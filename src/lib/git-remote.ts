import path from "node:path";
import { CheckRepoActions } from "simple-git";
import { createGitClient } from "./git";
import { isLocalPath } from "./validation";

export type RemoteRef = {
  sha: string;
  name: string;
  type: "branch" | "tag";
};

const fetchRemoteRefs = async (repoUrl: string): Promise<RemoteRef[]> => {
  const git = createGitClient();
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

const fetchLocalRefs = async (localPath: string): Promise<RemoteRef[]> => {
  const repoPath = localPath.startsWith("file://")
    ? localPath.slice(7)
    : path.resolve(localPath);

  const git = createGitClient({ baseDir: repoPath });
  const isBareRepo = await git.checkIsRepo(CheckRepoActions.BARE);
  const isNormalRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
  if (!isBareRepo && !isNormalRepo) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  let result: string;
  try {
    result = await git.raw(["show-ref"]);
  } catch {
    return [];
  }

  return result
    .split("\n")
    .filter(Boolean)
    .flatMap((line): RemoteRef[] => {
      const [sha, ref] = line.split(" ");
      if (ref.startsWith("refs/heads/")) {
        return [{ sha, name: ref.replace("refs/heads/", ""), type: "branch" }];
      }
      if (ref.startsWith("refs/tags/")) {
        return [{ sha, name: ref.replace("refs/tags/", ""), type: "tag" }];
      }
      return [];
    });
};

export const fetchRefs = async (repoUrl: string): Promise<RemoteRef[]> => {
  if (isLocalPath(repoUrl)) {
    return fetchLocalRefs(repoUrl);
  }
  return fetchRemoteRefs(repoUrl);
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
