import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import {
  generateTmpDir,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/fs-test-utils";
import { loadJsonConfig } from "./config-file";

type TestCase = {
  name: string;
  setup: (tmpDir: string) => Promise<void> | void;
  configFlag?: string;
  expectedSuccess: boolean;
  expectedError?: string;
  expectedConfig?: Record<string, unknown>;
};

const testCases: TestCase[] = [
  {
    name: "loads valid JSON config with all fields",
    setup: async (dir) => {
      await writeJsonConfig(dir, "patchy.json", {
        source_repo: "https://github.com/owner/repo.git",
        base_revision: "v1.0.0",
        patches_dir: "patches",
        clones_dir: "clones",
      });
    },
    expectedSuccess: true,
    expectedConfig: {
      source_repo: "https://github.com/owner/repo.git",
      base_revision: "v1.0.0",
      patches_dir: "patches",
      clones_dir: "clones",
    },
  },
  {
    name: "loads minimal valid config",
    setup: async (dir) => {
      await writeJsonConfig(dir, "patchy.json", {});
    },
    expectedSuccess: true,
    expectedConfig: {},
  },
  {
    name: "fails when default config file not found",
    setup: () => {},
    expectedSuccess: false,
    expectedError: "Configuration file not found",
  },
  {
    name: "fails when explicit config file not found",
    setup: () => {},
    configFlag: "custom.json",
    expectedSuccess: false,
    expectedError: "Configuration file not found",
  },
  {
    name: "loads config from custom path via flag",
    setup: async (dir) => {
      await writeJsonConfig(dir, "custom/config.json", {
        source_repo: "https://github.com/custom/repo.git",
      });
    },
    configFlag: "custom/config.json",
    expectedSuccess: true,
    expectedConfig: { source_repo: "https://github.com/custom/repo.git" },
  },
  {
    name: "handles JSONC (JSON with comments)",
    setup: async (dir) => {
      await writeTestFile(
        dir,
        "patchy.json",
        `{
          // This is a line comment
          "source_repo": "https://github.com/owner/repo.git",
          /* block comment */
          "base_revision": "main"
        }`,
      );
    },
    expectedSuccess: true,
    expectedConfig: {
      source_repo: "https://github.com/owner/repo.git",
      base_revision: "main",
    },
  },
  {
    name: "fails on invalid JSON syntax",
    setup: async (dir) => {
      await writeTestFile(dir, "patchy.json", "{ invalid json }");
    },
    expectedSuccess: false,
    expectedError: "JSON parse error",
  },
  {
    name: "fails on unknown fields (strict mode)",
    setup: async (dir) => {
      await writeJsonConfig(dir, "patchy.json", {
        source_repo: "https://github.com/owner/repo.git",
        unknown_field: "value",
      });
    },
    expectedSuccess: false,
    expectedError: "Invalid configuration file",
  },
  {
    name: "fails on invalid field types",
    setup: async (dir) => {
      await writeJsonConfig(dir, "patchy.json", {
        source_repo: 12345,
      });
    },
    expectedSuccess: false,
    expectedError: "Invalid configuration file",
  },
  {
    name: "handles trailing commas in JSONC",
    setup: async (dir) => {
      await writeTestFile(
        dir,
        "patchy.json",
        `{
          "source_repo": "https://github.com/owner/repo.git",
          "base_revision": "main",
        }`,
      );
    },
    expectedSuccess: true,
    expectedConfig: {
      source_repo: "https://github.com/owner/repo.git",
      base_revision: "main",
    },
  },
];

describe("loadJsonConfig", () => {
  for (const testCase of testCases) {
    it(testCase.name, async () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });
      await testCase.setup(tmpDir);

      const result = loadJsonConfig(tmpDir, testCase.configFlag);

      expect(result.success).toBe(testCase.expectedSuccess);

      if (testCase.expectedSuccess && result.success) {
        if (testCase.expectedConfig) {
          for (const [key, value] of Object.entries(testCase.expectedConfig)) {
            const configValue =
              result.config[key as keyof typeof result.config];
            expect(configValue).toBe(value as typeof configValue);
          }
        }
        expect(result.content).toBeDefined();
        expect(result.configPath).toContain(tmpDir);
      } else if (!testCase.expectedSuccess && !result.success) {
        if (testCase.expectedError) {
          expect(result.error).toContain(testCase.expectedError);
        }
      }
    });
  }

  it("returns correct configPath for default location", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    await writeJsonConfig(tmpDir, "patchy.json", {});

    const result = loadJsonConfig(tmpDir);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.configPath).toBe(`${tmpDir}/patchy.json`);
    }
  });

  it("returns correct configPath for custom location", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    await writeJsonConfig(tmpDir, "configs/custom.json", {});

    const result = loadJsonConfig(tmpDir, "configs/custom.json");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.configPath).toBe(`${tmpDir}/configs/custom.json`);
    }
  });

  it("returns raw file content for JSONC modification", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    const originalContent = `{
  // Important comment
  "source_repo": "https://github.com/owner/repo.git"
}`;
    await writeTestFile(tmpDir, "patchy.json", originalContent);

    const result = loadJsonConfig(tmpDir);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toBe(originalContent);
    }
  });
});
