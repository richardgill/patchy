# Patchy CLI Project

## Project Overview

This is a CLI tool for managing Git patch workflows. It helps maintain curated patches against upstream repositories.

## Development Commands

- `pnpm check-fix` - Run Biome linting/formatting checks
- `pnpm typecheck` - Type checking with tsgo
- `pnpm test` - Run all tests
- `pnpm dev` - Run CLI in development with tsx

When you're finished making your code changes run `pnpm typecheck`  `pnpm check-test` `pnpm test` in subagents

## Key Dependencies

- `@stricli/core` - CLI framework
- `es-toolkit` - Utility functions (lodash alternative)
- `enquirer` - Interactive prompts
- `yaml` - YAML parsing
- `zod` - Runtime validation

## Testing Preferences

- Use parameterized tests, each one has an it(...) with shared functions, keep tests DRY and maintainable
