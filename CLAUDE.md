# Patchy CLI Project

## Project Overview

This is a CLI tool for managing Git patch workflows. It helps maintain curated patches against upstream repositories.

## Development Commands

- `pnpm dev` - Run CLI in development with tsx

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
