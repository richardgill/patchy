## Test Classification

Tests must use the correct file suffix based on their type:

| Type | Suffix | Purpose | I/O Allowed | CLI Calls |
|------|--------|---------|-------------|-----------|
| Unit | `*.unit.test.ts` | Pure function testing | No | No |
| Integration | `*.integration.test.ts` | Internal modules with I/O | Yes | No |
| E2E | `*.e2e.test.ts` | Full CLI execution | Yes | Yes (`runCli()`) |

**Review checks:**
- [ ] Test file uses correct suffix for its type
- [ ] Unit tests don't perform I/O or call the CLI
- [ ] Integration tests don't invoke CLI commands
- [ ] E2E tests use `runCli()` / `runCliWithPrompts()` helpers


### Test Patterns
- [ ] unit and integration tests should use parameterized tests use `testCases.forEach(({ input, expected }) => it(...))`
- [ ] Uses custom matchers from `src/testing/matchers.ts` (e.g., `toSucceed()`, `toExist()`)
- [ ] Tests use `generateTmpDir()` for filesystem isolation (not raw temp paths)

### E2E-Specific
- [ ] Uses helpers from `src/testing/e2e-utils.ts` (`runCli()`, `acceptDefault()`, `cancel()`)
- [ ] Uses helpers from `src/testing/fs-test-utils.ts` (`setupTestWithConfig()`, `writeTestFile()`)
- [ ] Uses helpers from `src/testing/git-helpers.ts` for git setup
- [ ] Tests are very human readable and mostly 

## Code Style

### Function Size & Structure
- [ ] Main functions read as a sequence of well-named steps
- [ ] Orchestration functions fit in ~1.5 screen heights
- [ ] Functions are <8 lines ideal, 8-15 acceptable, 15+ needs justification

- [ ] Prefer `es-toolkit` as standard lib


- [ ] package.json script names use dashes, not colons (`test-node` not `test:node`)

