import { describe, expect, it } from "bun:test";
import { rv } from "~/testing/resolved-value-helpers";
import type { ConfigSources } from "./resolver";
import { type FlagMetadataMap, unwrapValue, type ValidatorFn } from "./types";
import { formatSourceLocation, validateConfig } from "./validation";

const testValidator: ValidatorFn<Record<string, unknown>> = (config, key) => {
  const value = unwrapValue(config[key]);
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
      mergedConfig: {
        name: rv("valid-name"),
        path: rv("./valid-path"),
        verbose: rv(true),
      },
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
      mergedConfig: {
        name: rv(undefined),
        path: rv("./valid-path"),
        verbose: rv(true),
      },
      requiredFields: ["name", "path"],
      sources: { flags: {}, env: {}, json: { path: "./valid-path" } },
      expectedSuccess: false,
      expectedErrorContains: ["Missing required parameters", "Missing Name"],
    },
    {
      name: "fails when validation fails",
      mergedConfig: {
        name: rv("invalid-name"),
        path: rv("./valid-path"),
      },
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
      mergedConfig: {
        name: rv("invalid-enriched"),
        path: rv("./original"),
      },
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
      mergedConfig: {
        name: rv(undefined),
        path: rv("./valid-path"),
      },
      requiredFields: ["name"],
      sources: { flags: {}, env: {}, json: { path: "./valid-path" } },
      formatInitHint: () => "Run: init --setup",
      expectedSuccess: false,
      expectedErrorContains: ["Run: init --setup"],
    },
    {
      name: "skips fields without validators",
      mergedConfig: {
        name: rv("valid"),
        verbose: rv(true),
      },
      requiredFields: ["name", "verbose"],
      sources: { flags: {}, env: {}, json: { name: "valid", verbose: true } },
      expectedSuccess: true,
    },
    {
      name: "reports multiple missing fields",
      mergedConfig: {
        name: rv(undefined),
        path: rv(undefined),
        verbose: rv(true),
      },
      requiredFields: ["name", "path"],
      sources: { flags: {}, env: {}, json: {} },
      expectedSuccess: false,
      expectedErrorContains: ["Missing Name", "Missing Path"],
    },
    {
      name: "reports multiple validation errors",
      mergedConfig: {
        name: rv("invalid-name"),
        path: rv("invalid-path"),
      },
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

  it("should accept a function for requiredFields", () => {
    const metadata = {
      field_a: {
        configField: true,
        requiredInConfig: false,
        env: "TEST_FIELD_A",
        type: "string",
        name: "Field A",
        stricliFlag: {
          "field-a": {
            kind: "parsed",
            parse: String,
            brief: "Field A",
            optional: true,
          },
        },
        example: "value",
        defaultValue: undefined,
      },
      field_b: {
        configField: true,
        requiredInConfig: false,
        env: "TEST_FIELD_B",
        type: "string",
        name: "Field B",
        stricliFlag: {
          "field-b": {
            kind: "parsed",
            parse: String,
            brief: "Field B",
            optional: true,
          },
        },
        example: "value",
        defaultValue: undefined,
      },
    } as const;

    const sources = {
      flags: {},
      env: {},
      json: { field_a: "/absolute/path" },
    };

    const requiredFields = (): Array<"field_a" | "field_b"> => ["field_a"];

    const result = validateConfig({
      metadata,
      mergedConfig: { field_a: rv("/absolute/path") },
      requiredFields,
      configPath: "./test.json",
      sources,
    });

    expect(result.success).toBe(true);
  });

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
