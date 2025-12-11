/** Converts snake_case string literal type to camelCase */
export type SnakeToCamel<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<SnakeToCamel<T>>}`
  : S;

/** Infer the parsed value type from a stricli flag definition */
type InferFlagValue<F> = F extends { kind: "boolean" }
  ? boolean
  : F extends { kind: "parsed"; parse: StringConstructor }
    ? string
    : F extends { kind: "parsed"; parse: NumberConstructor }
      ? number
      : F extends { kind: "parsed"; parse: (...args: unknown[]) => infer R }
        ? R
        : never;

/**
 * Derive parsed flag values type from stricli flag definitions.
 *
 * Input:
 *   {
 *     "repo-dir": { kind: "parsed"; parse: StringConstructor; optional: true };
 *     verbose: { kind: "boolean"; optional: true };
 *     ref: { kind: "parsed"; parse: StringConstructor; optional: false };
 *   }
 *
 * Output:
 *   {
 *     "repo-dir"?: string;
 *     verbose?: boolean;
 *     ref: string;
 *   }
 */
export type ParsedFlags<T extends Record<string, unknown>> = {
  [K in keyof T as T[K] extends { optional: true }
    ? K
    : never]?: InferFlagValue<T[K]>;
} & {
  [K in keyof T as T[K] extends { optional: true } ? never : K]: InferFlagValue<
    T[K]
  >;
};
