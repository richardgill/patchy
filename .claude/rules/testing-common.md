---
paths: "**/*.test.ts"
---

# Testing Rules (All Tests)

- Use `~/` imports instead of relative `../` imports
- `bun run test -- -u` to update inline snapshots
- Read `src/testing/matchers.ts` for custom matchers before writing tests
- Consider creating new helpers or custom matchers to optimize for human readability
