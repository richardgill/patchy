import type { RequirementPattern } from "./requirement-patterns";
import type { EnrichedMergedConfig } from "./types";

type WithRequired<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};

type ExtractGuarantees<P> = P extends RequirementPattern<infer G> ? G : never;

type AllGuaranteeKeys<
  Patterns extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
> = ExtractGuarantees<Patterns[number]>;

export type NarrowedConfig<
  Patterns extends readonly RequirementPattern<keyof EnrichedMergedConfig>[],
> = WithRequired<EnrichedMergedConfig, AllGuaranteeKeys<Patterns>>;
