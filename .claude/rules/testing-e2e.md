---
paths: "**/*.e2e.test.ts"
---

# E2E Testing Rules

- Read `src/testing/e2e-utils.ts` for CLI testing helpers:
  - `runCli()` / `runCliWithPrompts()` - execute CLI commands
  - `acceptDefault()` / `cancel()` - prompt interaction helpers
- Read `src/testing/fs-test-utils.ts` for filesystem helpers:
  - `generateTmpDir()` - create isolated temp directory
  - `setupTestWithConfig()` - set up test environment
  - `writeTestFile()` / `writeJsonConfig()` / `writeFileIn()` - write test files
- Read `src/testing/git-helpers.ts` for git test setup utilities
- Always use `generateTmpDir()` for test isolation
- Use custom matchers: `toSucceed()`, `toExist()`
