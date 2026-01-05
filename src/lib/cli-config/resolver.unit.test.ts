import { describe, expect, it } from "bun:test";
import { createMergedConfig, getValuesByKey } from "./resolver";
import type { ConfigSource, FlagMetadataMap } from "./types";

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
  debug: {
    configField: false,
    env: "TEST_DEBUG",
    type: "boolean",
    name: "Debug",
    stricliFlag: {
      debug: { kind: "boolean", brief: "Debug", optional: true },
    },
    example: "true",
    defaultValue: false,
  },
} as const satisfies FlagMetadataMap<"TEST">;

type TestInput = {
  flags: Record<string, unknown>;
  env: Record<string, string>;
  json: Record<string, unknown>;
};

type ExpectedValue = { value: unknown; source: ConfigSource };

const mergedConfigTestCases: {
  name: string;
  input: TestInput;
  expected: Record<string, ExpectedValue>;
}[] = [
  {
    name: "uses JSON values when no flags or env set",
    input: {
      flags: {},
      env: {},
      json: { name: "from-json", count: "10", verbose: true },
    },
    expected: {
      name: { value: "from-json", source: "config" },
      count: { value: "10", source: "config" },
      verbose: { value: true, source: "config" },
      debug: { value: false, source: "default" },
    },
  },
  {
    name: "prioritizes flags over env and JSON",
    input: {
      flags: { name: "from-flag", verbose: true },
      env: { TEST_NAME: "from-env", TEST_VERBOSE: "false" },
      json: { name: "from-json", verbose: false },
    },
    expected: {
      name: { value: "from-flag", source: "flag" },
      verbose: { value: true, source: "flag" },
    },
  },
  {
    name: "prioritizes env over JSON",
    input: {
      flags: {},
      env: { TEST_NAME: "from-env", TEST_VERBOSE: "true" },
      json: { name: "from-json", verbose: false },
    },
    expected: {
      name: { value: "from-env", source: "env" },
      verbose: { value: true, source: "env" },
    },
  },
  {
    name: "uses default values when nothing set",
    input: { flags: {}, env: {}, json: {} },
    expected: {
      name: { value: undefined, source: "default" },
      count: { value: "5", source: "default" },
      verbose: { value: false, source: "default" },
      debug: { value: false, source: "default" },
    },
  },
  {
    name: "ignores empty string env vars",
    input: {
      flags: {},
      env: { TEST_NAME: "" },
      json: { name: "from-json" },
    },
    expected: { name: { value: "from-json", source: "config" } },
  },
  {
    name: "handles runtime-only flags from CLI",
    input: { flags: { debug: true }, env: {}, json: {} },
    expected: { debug: { value: true, source: "flag" } },
  },
  {
    name: "handles runtime-only flags from env",
    input: { flags: {}, env: { TEST_DEBUG: "1" }, json: {} },
    expected: { debug: { value: true, source: "env" } },
  },
  // Boolean env parsing cases
  {
    name: "parses env 'true' as true",
    input: { flags: {}, env: { TEST_VERBOSE: "true" }, json: {} },
    expected: { verbose: { value: true, source: "env" } },
  },
  {
    name: "parses env 'TRUE' as true",
    input: { flags: {}, env: { TEST_VERBOSE: "TRUE" }, json: {} },
    expected: { verbose: { value: true, source: "env" } },
  },
  {
    name: "parses env '1' as true",
    input: { flags: {}, env: { TEST_VERBOSE: "1" }, json: {} },
    expected: { verbose: { value: true, source: "env" } },
  },
  {
    name: "parses env 'false' as false",
    input: { flags: {}, env: { TEST_VERBOSE: "false" }, json: {} },
    expected: { verbose: { value: false, source: "env" } },
  },
  {
    name: "parses env '0' as false",
    input: { flags: {}, env: { TEST_VERBOSE: "0" }, json: {} },
    expected: { verbose: { value: false, source: "env" } },
  },
  {
    name: "parses env 'yes' as false (only 'true' and '1' are truthy)",
    input: { flags: {}, env: { TEST_VERBOSE: "yes" }, json: {} },
    expected: { verbose: { value: false, source: "env" } },
  },
];

describe("createMergedConfig", () => {
  for (const { name, input, expected } of mergedConfigTestCases) {
    it(name, () => {
      const result = createMergedConfig({ metadata: TEST_METADATA, ...input });
      const config = result.mergedConfig as Record<string, ExpectedValue>;
      for (const [key, expectedValue] of Object.entries(expected)) {
        expect(config[key]).toEqual(expectedValue);
      }
    });
  }
});

const valuesByKeyTestCases: {
  name: string;
  sources: TestInput;
  expected: { flag: unknown; env: unknown; json: unknown };
}[] = [
  {
    name: "returns values from all sources",
    sources: {
      flags: { name: "from-flag" },
      env: { TEST_NAME: "from-env" },
      json: { name: "from-json" },
    },
    expected: { flag: "from-flag", env: "from-env", json: "from-json" },
  },
  {
    name: "returns undefined for missing values",
    sources: { flags: {}, env: {}, json: {} },
    expected: { flag: undefined, env: undefined, json: undefined },
  },
];

describe("getValuesByKey", () => {
  for (const { name, expected, sources } of valuesByKeyTestCases) {
    it(name, () => {
      const values = getValuesByKey(TEST_METADATA, "name", sources);
      expect(values.flag).toBe(expected.flag);
      expect(values.env).toBe(expected.env);
      expect(values.json).toBe(expected.json);
    });
  }
});
