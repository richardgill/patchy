// Stricli flag types
type StricliFlagParsed = {
  kind: "parsed";
  parse: StringConstructor | NumberConstructor;
  brief: string;
  optional: true;
};

type StricliFlagBoolean = {
  kind: "boolean";
  brief: string;
  optional: true;
};

type StricliFlag = StricliFlagParsed | StricliFlagBoolean;

// Base properties shared by all flag metadata entries
type BaseFlagMetadataEntry<TEnvPrefix extends string = string> = {
  env: `${TEnvPrefix}_${string}`;
  type: "string" | "boolean";
  name: string;
  stricliFlag: Record<string, StricliFlag>;
  example: string;
  defaultValue: string | boolean | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: validators need to accept any config type
  validate?: ValidatorFn<any>;
};

// Entry for flags that appear in the config file
type ConfigFieldEntry<TEnvPrefix extends string = string> =
  BaseFlagMetadataEntry<TEnvPrefix> & {
    configField: true;
    requiredInConfig: boolean;
  };

// Entry for runtime-only flags (not in config file)
type RuntimeFieldEntry<TEnvPrefix extends string = string> =
  BaseFlagMetadataEntry<TEnvPrefix> & {
    configField: false;
  };

type FlagMetadataEntry<TEnvPrefix extends string = string> =
  | ConfigFieldEntry<TEnvPrefix>
  | RuntimeFieldEntry<TEnvPrefix>;

export type FlagMetadataMap<TEnvPrefix extends string = string> = Record<
  string,
  FlagMetadataEntry<TEnvPrefix>
>;

// Maps type string literals to actual TypeScript types
export type TypeMap = {
  string: string;
  boolean: boolean;
};

// Generic validator function type
// TConfig is the config object passed to validators (e.g., EnrichedMergedConfig)
export type ValidatorFn<TConfig = Record<string, unknown>> = (
  config: TConfig,
  key: string,
) => string | null;
