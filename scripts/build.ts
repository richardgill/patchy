#!/usr/bin/env bun

// Inspired by opencode: https://github.com/sst/opencode/blob/main/packages/opencode/scripts/build.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";
import { PATCHY_VERSION_ENV_VAR } from "../src/constants";
import { getVersion } from "../src/version";
import { generateJsonSchema, SCHEMA_FILENAME } from "./generate-schema";

const CLI_NAME = "patchy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, "..");

process.chdir(projectDir);

const singleFlag = process.argv.includes("--single");

type Target = {
  os: "linux" | "darwin" | "win32";
  arch: "arm64" | "x64";
};

const allTargets: Target[] = [
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "darwin", arch: "arm64" },
  { os: "win32", arch: "x64" },
];

const targets = singleFlag
  ? allTargets.filter(
      (item) => item.os === process.platform && item.arch === process.arch,
    )
  : allTargets;

const version = await getVersion();

await $`rm -rf dist`;
await $`mkdir -p dist`;

const jsonSchema = generateJsonSchema();
const schemaPath = `dist/${SCHEMA_FILENAME}`;
await Bun.write(schemaPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
console.log(`Generated JSON Schema: ${schemaPath}`);

const binaries: Record<string, string> = {};

for (const item of targets) {
  const name = [
    CLI_NAME,
    // Use "windows" instead of "win32" for npm package naming
    item.os === "win32" ? "windows" : item.os,
    item.arch,
  ].join("-");

  const bunTarget = `bun-${item.os}-${item.arch}`;
  const binaryName = item.os === "win32" ? `${CLI_NAME}.exe` : CLI_NAME;

  console.log(`Building ${name} (${bunTarget})...`);

  await $`mkdir -p dist/${name}/bin`;

  await Bun.build({
    entrypoints: ["./src/cli.ts"],
    target: "bun",
    sourcemap: "external",
    minify: true,
    compile: {
      target: bunTarget as "bun",
      outfile: `dist/${name}/bin/${binaryName}`,
    },
    define: {
      [`process.env.${PATCHY_VERSION_ENV_VAR}`]: JSON.stringify(version),
    },
  });

  // Write platform-specific package.json
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version,
        description: `${CLI_NAME} CLI binary for ${item.os} ${item.arch}`,
        os: [item.os],
        cpu: [item.arch],
        license: "MIT",
        repository: {
          type: "git",
          url: "git+https://github.com/richardgill/patchy.git",
        },
      },
      null,
      2,
    ),
  );

  binaries[name] = version;
  console.log(`  ✓ Built ${name}`);
}

console.log(
  `\nBuilt ${Object.keys(binaries).length} binaries for version ${version}`,
);

export { binaries, version };
