// At build time, PATCHY_VERSION is injected via `define` in script/build.ts
// At runtime in dev, we read from package.json
// Falls back to "0.0.0" if neither is available

const getVersionFromPackageJson = async (): Promise<string> => {
  try {
    const pkg = await Bun.file("./package.json").json();
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

export const getVersion = async (): Promise<string> => {
  return process.env["PATCHY_VERSION"] ?? (await getVersionFromPackageJson());
};

// Synchronous version for CLI --version flag (injected at build time, falls back to 0.0.0 in dev)
export const VERSION = process.env["PATCHY_VERSION"] ?? "0.0.0";

export const getSchemaUrl = async () =>
  `https://unpkg.com/patchy-cli@${await getVersion()}/dist/patchy.schema.json`;
