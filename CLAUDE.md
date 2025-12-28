@BEADS.md

# Patchy CLI Project

## Project Overview

This is a CLI tool for managing Git patch workflows. It helps maintain curated patches against upstream repositories.

## Development Commands

- `bun run dev` - Run CLI in development with bun
- Use dashes (not colons) for package.json script names: `test-node` not `test:node`

## Key Dependencies

- `@stricli/core` - CLI framework
- `es-toolkit` - Utility functions (lodash alternative)
- `clack` - Interactive prompts
- `jsonc-parser` - JSON with comments parsing
- `zod` - Runtime validation

## Checking all changes

Always run `bun run local-ci` it runs formatter, linter & tests

## Testing

This codebase has three types of tests:
- **Unit tests** (`*.unit.test.ts`) - Pure function testing, no I/O, fast
- **Integration tests** (`*.integration.test.ts`) - Internal modules with I/O, no CLI
- **E2E tests** (`*.e2e.test.ts`) - Full CLI execution via `runCli()`

E2E tests are organized 1:1 with commands - each command has its own e2e test file in the command's directory (e.g., `src/commands/init/impl.e2e.test.ts`).

**Always write tests for new functions.** Find the appropriate type of test and test file (or create one) and add coverage. If in doubt - E2E is the preferred type of test.

## Releasing

Use add changeset skill

## Dependencies

- All dependencies use pinned versions with `=` syntax (e.g., `=1.2.3`)
