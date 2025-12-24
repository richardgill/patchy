#!/usr/bin/env bun

// Syncs optionalDependencies versions to match the main package version.
// Run after `changeset version` to keep platform packages in sync.

const main = async () => {
  const pkgPath = new URL("../package.json", import.meta.url).pathname;
  const pkg = await Bun.file(pkgPath).json();

  const version = `=${pkg.version}`;
  const platformPackages = Object.keys(pkg.optionalDependencies);
  pkg.optionalDependencies = Object.fromEntries(
    platformPackages.map((name) => [name, version]),
  );

  await Bun.write(pkgPath, `${JSON.stringify(pkg, null, "  ")}\n`);

  console.log(`Synced optionalDependencies to ${version}`);
};

main();
