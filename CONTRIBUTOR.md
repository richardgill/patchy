# Contributing to Patchy

## Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Run CLI in development
pnpm test         # Run tests
pnpm typecheck    # Type check
pnpm check-fix    # Lint and format
pnpm local-ci     # Run all checks
```

## Distribution

### npm Package (default)

```bash
pnpm build              # Build with tsdown
pnpm changeset          # Create changeset for release
pnpm changeset-publish  # Build and publish to npm
```

Entry point `src/cli.ts` requires shebang: `#!/usr/bin/env node`

### Bun Binaries (standalone executables)

Build standalone binaries that don't require Node.js:

```bash
pnpm build-binary         # Build all 5 platforms
pnpm build-binary-single  # Build current platform only
pnpm publish-binary       # Build + publish to npm + create archives
```

**Platforms:** linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64

**Files:**
- `script/build.ts` - Compiles to standalone binaries
- `script/publish.ts` - Publishes platform packages to npm
- `script/postinstall.mjs` - Symlinks correct binary after install
- `bin/patchy` - Wrapper that finds platform binary

> Pattern based on [opencode](https://github.com/sst/opencode) - see their `script/` directory for reference.
