---
paths: "**/*.integration.test.ts"
---
# Integration Testing Rules

- Use parameterized tests with test case arrays and `testCases.forEach(({ input, expected }) => it(...))`
- Test internal modules that perform I/O (git operations, file system, config loading)
- Do NOT go through the CLI interface (use e2e tests for that)
- Use `generateTmpDir()` for filesystem isolation
- Use `src/testing/git-helpers.ts` for git test setup
- Use `src/testing/fs-test-utils.ts` for filesystem helpers
- Can be slower than unit tests due to I/O operations
