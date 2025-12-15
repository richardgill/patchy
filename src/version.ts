// At build time, PATCHY_VERSION is injected via `define` in scripts/build.ts
// At runtime in dev, we read from package.json
// Falls back to "0.0.0" if neither is available

// Must use literal string for bundler's define replacement to work (not dynamic property access)
// biome-ignore lint/suspicious/noExplicitAny: required for bundler define replacement
const INJECTED_VERSION = (process.env as any).PATCHY_VERSION as
  | string
  | undefined;

const getVersionFromPackageJson = async (): Promise<string> => {
  try {
    const pkg = await Bun.file("./package.json").json();
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
};

export const getVersion = async (): Promise<string> => {
  return INJECTED_VERSION ?? (await getVersionFromPackageJson());
};

// Synchronous version for CLI --version flag (injected at build time, falls back to 0.0.0 in dev)
export const VERSION = INJECTED_VERSION ?? "0.0.0";

export const getSchemaUrl = async () =>
  `https://unpkg.com/patchy-cli@${await getVersion()}/schema.json`;
