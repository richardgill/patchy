import { describe, expect, it } from "bun:test";
import type { ConfigSources } from "./resolver";
import type { FlagMetadataMap, ValidatorFn } from "./types";
import { formatSourceLocation, validateConfig } from "./validation";

// Test validator that fails for values starting with "invalid"
const testValidator: ValidatorFn<Record<string, unknown>> = (config, key) => {
  const value = config[key];
  if (typeof value === "string" && value.startsWith("invalid")) {
    return "is invalid";
  }
  return null;
};

// Minimal test metadata with validators
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
    validate: testValidator,
  },
  path: {
    configField: true,
    requiredInConfig: false,
    env: "TEST_PATH",
    type: "string",
    name: "Path",
    stricliFlag: {
      path: { kind: "parsed", parse: String, brief: "Path", optional: true },
    },
    example: "./path",
    defaultValue: undefined,
    validate: testValidator,
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
} as const satisfies FlagMetadataMap<"TEST">;

type TestSources = ConfigSources<typeof TEST_METADATA, Record<string, unknown>>;

describe("formatSourceLocation", () => {
  const sourceLocationTestCases: {
    name: string;
    key: "name" | "path" | "verbose";
    sources: TestSources;
    expected: string;
  }[] = [
    {
      name: "returns flag format when flag is set",
      key: "name",
      sources: {
        flags: { name: "from-flag" },
        env: { TEST_NAME: "from-env" },
        json: { name: "from-json" },
      },
      expected: "--name from-flag",
    },
    {
      name: "returns env format when only env is set",
      key: "name",
      sources: {
        flags: {},
        env: { TEST_NAME: "from-env" },
        json: { name: "from-json" },
      },
      expected: "TEST_NAME=from-env",
    },
    {
      name: "returns json format when only json is set",
      key: "name",
      sources: {
        flags: {},
        env: {},
        json: { name: "from-json" },
      },
      expected: "name: from-json in ./config.json",
    },
    {
      name: "returns field name when nothing is set",
      key: "name",
      sources: {
        flags: {},
        env: {},
        json: {},
      },
      expected: "Name",
    },
  ];

  for (const { name, key, sources, expected } of sourceLocationTestCases) {
    it(name, () => {
      const result = formatSourceLocation(
        TEST_METADATA,
        key,
        sources,
        "./config.json",
      );
      expect(result).toBe(expected);
    });
  }
});

describe("validateConfig", () => {
  const validateConfigTestCases: {
    name: string;
    mergedConfig: Record<string, unknown>;
    requiredFields: ("name" | "path" | "verbose")[];
    sources: TestSources;
    formatInitHint?: (configPath: string, sources: TestSources) => string;
    expectedSuccess: boolean;
    expectedErrorContains?: string[];
  }[] = [
    {
      name: "succeeds when all required fields present and valid",
      mergedConfig: { name: "valid-name", path: "./valid-path", verbose: true },
      requiredFields: ["name", "path"],
      sources: {
        flags: {},
        env: {},
        json: { name: "valid-name", path: "./valid-path" },
      },
      expectedSuccess: true,
    },
    {
      name: "fails when required field is missing",
      mergedConfig: { path: "./valid-path", verbose: true },
      requiredFields: ["name", "path"],
      sources: { flags: {}, env: {}, json: { path: "./valid-path" } },
      expectedSuccess: false,
      expectedErrorContains: ["Missing required parameters", "Missing Name"],
    },
    {
      name: "fails when validation fails",
      mergedConfig: { name: "invalid-name", path: "./valid-path" },
      requiredFields: ["name", "path"],
      sources: {
        flags: {},
        env: {},
        json: { name: "invalid-name", path: "./valid-path" },
      },
      expectedSuccess: false,
      expectedErrorContains: ["Validation errors", "is invalid"],
    },
    {
      name: "validates using mergedConfig values directly",
      mergedConfig: { name: "invalid-enriched", path: "./original" },
      requiredFields: ["name", "path"],
      sources: {
        flags: {},
        env: {},
        json: { name: "original", path: "./original" },
      },
      expectedSuccess: false,
      expectedErrorContains: ["is invalid"],
    },
    {
      name: "includes formatInitHint in missing fields error",
      mergedConfig: { path: "./valid-path" },
      requiredFields: ["name"],
      sources: { flags: {}, env: {}, json: { path: "./valid-path" } },
      formatInitHint: () => "Run: init --setup",
      expectedSuccess: false,
      expectedErrorContains: ["Run: init --setup"],
    },
    {
      name: "skips fields without validators",
      mergedConfig: { name: "valid", verbose: true },
      requiredFields: ["name", "verbose"],
      sources: { flags: {}, env: {}, json: { name: "valid", verbose: true } },
      expectedSuccess: true,
    },
    {
      name: "reports multiple missing fields",
      mergedConfig: { verbose: true },
      requiredFields: ["name", "path"],
      sources: { flags: {}, env: {}, json: {} },
      expectedSuccess: false,
      expectedErrorContains: ["Missing Name", "Missing Path"],
    },
    {
      name: "reports multiple validation errors",
      mergedConfig: { name: "invalid-name", path: "invalid-path" },
      requiredFields: ["name", "path"],
      sources: {
        flags: {},
        env: {},
        json: { name: "invalid-name", path: "invalid-path" },
      },
      expectedSuccess: false,
      expectedErrorContains: ["name: invalid-name", "path: invalid-path"],
    },
  ];

  for (const testCase of validateConfigTestCases) {
    it(testCase.name, () => {
      const result = validateConfig({
        metadata: TEST_METADATA,
        mergedConfig: testCase.mergedConfig,
        requiredFields: testCase.requiredFields,
        configPath: "./config.json",
        sources: testCase.sources,
        formatInitHint: testCase.formatInitHint,
      });

      expect(result.success).toBe(testCase.expectedSuccess);

      if (!testCase.expectedSuccess && !result.success) {
        if (testCase.expectedErrorContains) {
          for (const substr of testCase.expectedErrorContains) {
            expect(result.error).toContain(substr);
          }
        }
      }
    });
  }
});
