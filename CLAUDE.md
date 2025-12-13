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
- `enquirer` - Interactive prompts
- `jsonc-parser` - JSON with comments parsing
- `zod` - Runtime validation

## Testing Preferences

- Use parameterized tests, each one has an it(...) with shared functions, keep tests DRY and maintainable
- `bun run test -- -u` to update inline snapshots
- Use `~/` imports instead of relative `../` imports
- Read `src/testing/matchers.ts` and `src/testing/test-utils.ts` before writing tests for available helpers and custom matchers
- When writing tests, consider whether you could use or create new helpers or custom matchers to optimize for human readability

## Runtime Testing

The CLI uses Bun as its runtime:
- `bun run test` - Run e2e tests with CLI executing on Bun

The test suite uses bun:test and spawns the actual CLI as a subprocess using `bun`.

## Releasing

Run `bun run changeset` to bump version and generate CHANGELOG
