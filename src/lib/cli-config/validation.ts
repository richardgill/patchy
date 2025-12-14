import chalk from "chalk";
import { isNil } from "es-toolkit";
import { formatPathForDisplay } from "~/lib/fs";
import { type ConfigSources, getValuesByKey } from "./resolver";
import { type DeriveJsonConfigKey, getFlagName } from "./type-derivations";
import type { FlagMetadataMap, ValidatorFn } from "./types";

// Format where a config value came from (for error messages)
export const formatSourceLocation = <
  M extends FlagMetadataMap,
  K extends DeriveJsonConfigKey<M>,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
>(
  metadata: M,
  key: K,
  sources: ConfigSources<M, TJson>,
  configPath: string,
): string => {
  const meta = metadata[key];
  const flagName = getFlagName(metadata, key);
  const values = getValuesByKey(metadata, key, sources);

  if (values.flag) {
    return `--${flagName} ${values.flag}`;
  }
  if (values.env !== undefined) {
    return `${meta.env}=${sources.env[meta.env]}`;
  }
  if (values.json) {
    return `${key}: ${values.json} in ${formatPathForDisplay(configPath)}`;
  }
  return meta.name;
};

type ValidateConfigParams<
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
  TConfig,
> = {
  metadata: M;
  mergedConfig: TConfig;
  requiredFields: DeriveJsonConfigKey<M>[];
  configPath: string;
  sources: ConfigSources<M, TJson>;
  // Optional callback to format the "init" hint message
  formatInitHint?: (
    configPath: string,
    sources: ConfigSources<M, TJson>,
  ) => string;
};

type ValidateConfigResult =
  | { success: true }
  | { success: false; error: string };

export const validateConfig = <
  M extends FlagMetadataMap,
  TJson extends Partial<Record<DeriveJsonConfigKey<M>, unknown>>,
  TConfig extends Record<string, unknown>,
>({
  metadata,
  mergedConfig,
  requiredFields,
  configPath,
  sources,
  formatInitHint,
}: ValidateConfigParams<M, TJson, TConfig>): ValidateConfigResult => {
  // Check for missing required fields
  const missingFields = requiredFields.filter((field) => {
    return isNil(mergedConfig[field]);
  });

  if (missingFields.length > 0) {
    const missingFieldLines = missingFields.map((fieldKey) => {
      const field = metadata[fieldKey];
      const flagName = getFlagName(metadata, fieldKey);
      return `  Missing ${chalk.bold(field.name)}: set ${chalk.cyan(fieldKey)} in ${chalk.blue(formatPathForDisplay(configPath))}, ${chalk.cyan(field.env)} env var, or ${chalk.cyan(`--${flagName}`)} flag`;
    });

    const initHint = formatInitHint?.(configPath, sources) ?? "";
    const missingFieldsError = `${[
      chalk.red.bold("Missing required parameters:"),
      "",
      ...missingFieldLines,
      "",
      ...(initHint ? [initHint] : []),
    ].join("\n")}\n\n`;

    return { success: false, error: missingFieldsError };
  }

  // Run validators
  const validationErrors: string[] = [];

  for (const key of requiredFields) {
    const meta = metadata[key];
    if (!("validate" in meta) || !meta.validate) continue;

    // Use enriched value if provided, otherwise use merged config value
    const validator = meta.validate as ValidatorFn<TConfig>;
    const error = validator(mergedConfig, key);

    if (error) {
      validationErrors.push(
        `${formatSourceLocation(metadata, key, sources, configPath)} ${error}`,
      );
    }
  }

  if (validationErrors.length > 0) {
    const validationError = `${[
      chalk.red.bold("Validation errors:"),
      "",
      ...validationErrors,
    ].join("\n")}\n\n`;

    return { success: false, error: validationError };
  }

  return { success: true };
};
