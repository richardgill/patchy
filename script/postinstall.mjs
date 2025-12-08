#!/usr/bin/env node

// Inspired by opencode: https://github.com/sst/opencode/blob/main/packages/opencode/script/postinstall.mjs

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI_NAME = "patchy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const detectPlatformAndArch = () => {
  const platformMap = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows",
  };

  const archMap = {
    x64: "x64",
    arm64: "arm64",
  };

  const platform = platformMap[os.platform()] ?? os.platform();
  const arch = archMap[os.arch()] ?? os.arch();

  return { platform, arch };
};

const findBinary = () => {
  const { platform, arch } = detectPlatformAndArch();
  const packageName = `${CLI_NAME}-${platform}-${arch}`;
  const binaryName = platform === "windows" ? `${CLI_NAME}.exe` : CLI_NAME;

  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    const packageDir = path.dirname(packageJsonPath);
    const binaryPath = path.join(packageDir, "bin", binaryName);

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`);
    }

    return { binaryPath, binaryName };
  } catch (error) {
    throw new Error(`Could not find package ${packageName}: ${error.message}`);
  }
};

const prepareBinDirectory = (binaryName) => {
  const binDir = path.join(__dirname, "..", "bin");
  const targetPath = path.join(binDir, binaryName);

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }

  return { binDir, targetPath };
};

const symlinkBinary = (sourcePath, binaryName) => {
  const { targetPath } = prepareBinDirectory(binaryName);

  fs.symlinkSync(sourcePath, targetPath);
  console.log(`${CLI_NAME} binary symlinked: ${targetPath} -> ${sourcePath}`);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Failed to symlink binary to ${targetPath}`);
  }
};

const main = async () => {
  try {
    if (os.platform() === "win32") {
      console.log(
        "Windows detected: binary setup not needed (using packaged .exe)",
      );
      return;
    }

    const { binaryPath, binaryName } = findBinary();
    symlinkBinary(binaryPath, binaryName);
  } catch (error) {
    console.error(`Failed to setup ${CLI_NAME} binary:`, error.message);
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  console.error("Postinstall script error:", error.message);
  process.exit(0);
}
