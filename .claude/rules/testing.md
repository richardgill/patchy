---
paths: "**/*.test.ts"
---

# Testing Rules

- Use parameterized tests, each one has an `it(...)` with shared functions, keep tests DRY and maintainable
- `bun run test -- -u` to update inline snapshots
- Use `~/` imports instead of relative `../` imports
- Read `src/testing/matchers.ts` and `src/testing/test-utils.ts` before writing tests for available helpers and custom matchers
- When writing tests, consider whether you could use or create new helpers or custom matchers to optimize for human readability
