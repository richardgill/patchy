#!/usr/bin/env bun

// Inspired by opencode: https://github.com/sst/opencode/blob/main/packages/opencode/script/publish.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const NPM_ORG = "richardgill";
const CLI_NAME = "patchy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, "..");

process.chdir(projectDir);

const pkg = await Bun.file("./package.json").json();

// Import binaries from build script (this runs the build)
const { binaries, version } = await import("./build.ts");

// Smoke test: run the binary for the current platform
{
  const platformMap: Record<string, string> = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows",
  };
  const platform = platformMap[process.platform] ?? process.platform;
  const name = `${CLI_NAME}-${platform}-${process.arch}`;

  console.log(`\nSmoke test: running dist/${name}/bin/${CLI_NAME} --version`);
  await $`./dist/${name}/bin/${CLI_NAME} --version`;
}

// Create main package directory
const mainPackageName = pkg.name.replace(`@${NPM_ORG}/`, "") + "-ai";
await $`mkdir -p ./dist/${mainPackageName}`;
await $`cp -r ./bin ./dist/${mainPackageName}/bin`;
await $`cp ./script/postinstall.mjs ./dist/${mainPackageName}/postinstall.mjs`;

// Write main package.json with optionalDependencies
await Bun.file(`./dist/${mainPackageName}/package.json`).write(
  JSON.stringify(
    {
      name: mainPackageName,
      version,
      description: pkg.description,
      bin: {
        [CLI_NAME]: `./bin/${CLI_NAME}`,
      },
      scripts: {
        postinstall: "node ./postinstall.mjs",
      },
      optionalDependencies: binaries,
      license: "MIT",
      repository: pkg.repository,
      keywords: pkg.keywords,
      author: pkg.author,
    },
    null,
    2,
  ),
);

console.log(
  `\nPublishing ${Object.keys(binaries).length} platform packages...`,
);

// Publish platform-specific packages
for (const [name] of Object.entries(binaries)) {
  try {
    process.chdir(`./dist/${name}`);
    if (process.platform !== "win32") {
      await $`chmod 755 -R .`;
    }
    console.log(`Publishing ${name}@${version}...`);
    await $`npm publish --access public`;
  } finally {
    process.chdir(projectDir);
  }
}

// Publish main package
console.log(`\nPublishing ${mainPackageName}@${version}...`);
await $`cd ./dist/${mainPackageName} && npm publish --access public`;

console.log(`\n✓ Published all packages for version ${version}`);

// Create GitHub release assets (tar.gz for Linux, zip for others)
console.log("\nCreating release archives...");
for (const [name] of Object.entries(binaries)) {
  if (name.includes("linux")) {
    await $`cd dist/${name}/bin && tar -czf ../../${name}.tar.gz *`;
  } else {
    await $`cd dist/${name}/bin && zip -r ../../${name}.zip *`;
  }
  console.log(`  ✓ Created ${name} archive`);
}

console.log("\nRelease archives ready in dist/:");
await $`ls -la dist/*.tar.gz dist/*.zip 2>/dev/null || true`;
