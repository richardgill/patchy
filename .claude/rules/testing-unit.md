---
paths: "**/*.unit.test.ts"
---

# Unit Testing Rules

- Use parameterized tests with test case arrays and `testCases.forEach(({ input, expected }) => it(...))`
- Prefer testing pure functions in isolation
- Keep tests DRY with shared test case data structures
- If filesystem setup is needed, use `src/testing/fs-test-utils.ts` helpers
