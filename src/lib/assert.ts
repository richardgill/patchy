export const assertDefined = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`Expected ${name} to be defined`);
  }
  return value;
};
