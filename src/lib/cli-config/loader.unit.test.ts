import { describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import {
  generateTmpDir,
  writeJsonConfig,
  writeTestFile,
} from "~/testing/fs-test-utils";
import { loadConfigFromFile } from "./loader";
import type { FlagMetadataMap } from "./types";

// Minimal test metadata - not patchy-specific
const TEST_METADATA = {
  name: {
    configField: true,
    requiredInConfig: true,
    env: "TEST_NAME",
    type: "string",
    name: "Name",
    stricliFlag: {
      name: { kind: "parsed", parse: String, brief: "Name", optional: true },
    },
    example: "my-name",
    defaultValue: undefined,
  },
  count: {
    configField: true,
    requiredInConfig: false,
    env: "TEST_COUNT",
    type: "string",
    name: "Count",
    stricliFlag: {
      count: { kind: "parsed", parse: String, brief: "Count", optional: true },
    },
    example: "10",
    defaultValue: "5",
  },
  base_revision: {
    configField: true,
    requiredInConfig: false,
    env: "TEST_BASE_REVISION",
    type: "string",
    name: "Base revision",
    stricliFlag: {
      "base-revision": {
        kind: "parsed",
        parse: String,
        brief: "Base revision",
        optional: true,
      },
    },
    example: "abc123",
    defaultValue: undefined,
  },
  verbose: {
    configField: true,
    requiredInConfig: false,
    env: "TEST_VERBOSE",
    type: "boolean",
    name: "Verbose",
    stricliFlag: {
      verbose: { kind: "boolean", brief: "Verbose", optional: true },
    },
    example: "true",
    defaultValue: false,
  },
  config: {
    configField: false,
    env: "TEST_CONFIG",
    type: "string",
    name: "Config",
    stricliFlag: {
      config: {
        kind: "parsed",
        parse: String,
        brief: "Config",
        optional: true,
      },
    },
    example: "./test.json",
    defaultValue: "./test.json",
  },
} as const satisfies FlagMetadataMap<"TEST">;

const testSchema = z
  .object({
    name: z.string().optional(),
    count: z.string().optional(),
    base_revision: z.string().optional(),
    verbose: z.boolean().optional(),
  })
  .strict();

type TestJson = z.infer<typeof testSchema>;

describe("loadConfigFromFile", () => {
  const loadTestCases: {
    name: string;
    setup: (tmpDir: string) => Promise<void> | void;
    flags: Record<string, unknown>;
    env?: Record<string, string | undefined>;
    expectedSuccess: boolean;
    expectedError?: string;
    expectedConfig?: Partial<Record<string, unknown>>;
  }[] = [
    {
      name: "loads valid JSON config",
      setup: async (dir) => {
        await writeJsonConfig(dir, "test.json", {
          name: "test-name",
          count: "10",
          verbose: true,
        });
      },
      flags: {},
      expectedSuccess: true,
      expectedConfig: { name: "test-name", count: "10", verbose: true },
    },
    {
      name: "succeeds with empty config when default file not found",
      setup: () => {},
      flags: {},
      expectedSuccess: true,
      expectedConfig: { name: undefined, count: "5", verbose: false },
    },
    {
      name: "fails when explicit config path not found",
      setup: () => {},
      flags: { config: "./does-not-exist.json" },
      expectedSuccess: false,
      expectedError: "Configuration file not found",
    },
    {
      name: "fails when env-specified config not found",
      setup: () => {},
      flags: {},
      env: { TEST_CONFIG: "./from-env-not-found.json" },
      expectedSuccess: false,
      expectedError: "Configuration file not found",
    },
    {
      name: "fails on invalid JSON",
      setup: async (dir) => {
        await writeTestFile(dir, "test.json", "{ invalid json }");
      },
      flags: {},
      expectedSuccess: false,
      expectedError: "JSON parse error",
    },
    {
      name: "fails on Zod validation error",
      setup: async (dir) => {
        await writeJsonConfig(dir, "test.json", {
          name: 123,
          verbose: "not-boolean",
        });
      },
      flags: {},
      expectedSuccess: false,
      expectedError: "Invalid input",
    },
    {
      name: "fails on unknown fields (strict mode)",
      setup: async (dir) => {
        await writeJsonConfig(dir, "test.json", {
          name: "test",
          unknown_field: "value",
        });
      },
      flags: {},
      expectedSuccess: false,
      expectedError: "Unrecognized key",
    },
    {
      name: "merges flags with JSON values",
      setup: async (dir) => {
        await writeJsonConfig(dir, "test.json", {
          name: "from-json",
          verbose: false,
        });
      },
      flags: { name: "from-flag", verbose: true },
      expectedSuccess: true,
      expectedConfig: { name: "from-flag", verbose: true },
    },
    {
      name: "merges env with JSON values",
      setup: async (dir) => {
        await writeJsonConfig(dir, "test.json", {
          name: "from-json",
          verbose: false,
        });
      },
      flags: {},
      env: { TEST_NAME: "from-env", TEST_VERBOSE: "true" },
      expectedSuccess: true,
      expectedConfig: { name: "from-env", verbose: true },
    },
    {
      name: "uses custom config path from flag",
      setup: async (dir) => {
        await writeJsonConfig(dir, "custom/config.json", {
          name: "custom-name",
        });
      },
      flags: { config: "./custom/config.json" },
      expectedSuccess: true,
      expectedConfig: { name: "custom-name" },
    },
    {
      name: "uses custom config path from env",
      setup: async (dir) => {
        await writeJsonConfig(dir, "env-custom/config.json", {
          name: "env-custom-name",
        });
      },
      flags: {},
      env: { TEST_CONFIG: "./env-custom/config.json" },
      expectedSuccess: true,
      expectedConfig: { name: "env-custom-name" },
    },
    {
      name: "handles JSONC (JSON with comments)",
      setup: async (dir) => {
        await writeTestFile(
          dir,
          "test.json",
          `{
            // This is a comment
            "name": "with-comments",
            /* block comment */
            "verbose": true
          }`,
        );
      },
      flags: {},
      expectedSuccess: true,
      expectedConfig: { name: "with-comments", verbose: true },
    },
  ];

  for (const testCase of loadTestCases) {
    it(testCase.name, async () => {
      const tmpDir = generateTmpDir();
      mkdirSync(tmpDir, { recursive: true });
      await testCase.setup(tmpDir);

      const result = loadConfigFromFile<typeof TEST_METADATA, TestJson>({
        metadata: TEST_METADATA,
        flags: testCase.flags,
        cwd: tmpDir,
        env: testCase.env ?? {},
        defaultConfigPath: "./test.json",
        configFlagKey: "config",
        schema: testSchema,
      });

      expect(result.success).toBe(testCase.expectedSuccess);

      if (testCase.expectedSuccess && result.success) {
        if (testCase.expectedConfig) {
          for (const [key, value] of Object.entries(testCase.expectedConfig)) {
            expect((result.mergedConfig as Record<string, unknown>)[key]).toBe(
              value,
            );
          }
        }
      } else if (!testCase.expectedSuccess && !result.success) {
        if (testCase.expectedError) {
          expect(result.error).toContain(testCase.expectedError);
        }
      }
    });
  }

  it("calls custom formatZodError when provided", async () => {
    const tmpDir = generateTmpDir();
    mkdirSync(tmpDir, { recursive: true });
    await writeJsonConfig(tmpDir, "test.json", { name: 123 });

    const result = loadConfigFromFile<typeof TEST_METADATA, TestJson>({
      metadata: TEST_METADATA,
      flags: {},
      cwd: tmpDir,
      env: {},
      defaultConfigPath: "./test.json",
      configFlagKey: "config",
      schema: testSchema,
      formatZodError: () => "custom error message",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("custom error message");
    }
  });
});
