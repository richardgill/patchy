## Testing Rules

@.claude/rules/testing-common.md
@.claude/rules/testing-unit.md
@.claude/rules/testing-integration.md
@.claude/rules/testing-e2e.md

## Additional Review Checks for Todolist
- [ ] We have tests for all changes
- [ ] Test file uses correct suffix for its type
- [ ] Main functions read as a sequence of well-named steps
- [ ] Orchestration functions fit in ~1.5 screen heights
- [ ] Functions are <8 lines ideal, 8-15 acceptable, 15+ needs justification
- [ ] Prefer `es-toolkit` as standard lib
- [ ] package.json script names use dashes, not colons (`test-node` not `test:node`)

