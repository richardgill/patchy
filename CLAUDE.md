@BEADS.md

# Patchy CLI Project

## Project Overview

This is a CLI tool for managing Git patch workflows. It helps maintain curated patches against upstream repositories.

## Development Commands

- `pnpm dev` - Run CLI in development with tsx
- Use dashes (not colons) for package.json script names: `test-node` not `test:node`

## Key Dependencies

- `@stricli/core` - CLI framework
- `es-toolkit` - Utility functions (lodash alternative)
- `enquirer` - Interactive prompts
- `jsonc-parser` - JSON with comments parsing
- `zod` - Runtime validation

## Testing Preferences

- Use parameterized tests, each one has an it(...) with shared functions, keep tests DRY and maintainable
- `pnpm run test -- -u` to update inline snapshots
- Use `~/` imports instead of relative `../` imports

## Runtime Testing

The CLI is tested on both Node.js and Bun runtimes:
- `pnpm test` - Run e2e tests with CLI executing on Node.js
- `pnpm test-bun` - Run e2e tests with CLI executing on Bun

The test suite uses vitest (running on Node), but spawns the actual CLI as a subprocess using either `node` or `bun` based on the `TEST_RUNTIME` env var.
