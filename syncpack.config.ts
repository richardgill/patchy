import { defineConfig } from "syncpack";

export default defineConfig({
  semverGroups: [
    {
      label: "Peer dependencies allow any range",
      packages: ["**"],
      dependencyTypes: ["peer"],
      isIgnored: true,
    },
    {
      label: "All other dependencies must be pinned with =",
      packages: ["**"],
      dependencyTypes: ["dev", "prod", "optional"],
      range: "=",
    },
  ],
  versionGroups: [
    {
      label: "Ignore peer dependencies from version syncing",
      packages: ["**"],
      dependencyTypes: ["peer"],
      isIgnored: true,
    },
  ],
});
