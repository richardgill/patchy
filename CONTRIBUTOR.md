# Contributing to Patchy

## Development

```bash
bun install      # Install dependencies
bun run dev      # Run CLI in development
bun run test     # Run tests
bun run typecheck    # Type check
bun run check-fix    # Lint and format
bun run local-ci     # Run all checks
```

## Distribution

### npm Package (default)

```bash
bun run build              # Build with tsdown
bun run changeset          # Create changeset for release
bun run changeset-publish  # Build and publish to npm
```

Entry point `src/cli.ts` requires shebang: `#!/usr/bin/env node`

### Bun Binaries (standalone executables)

Build standalone binaries that don't require Node.js:

```bash
bun run build-binary         # Build all 5 platforms
bun run build-binary-single  # Build current platform only
bun run publish-binary       # Build + publish to npm + create archives
```

**Platforms:** linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64

**Files:**
- `script/build.ts` - Compiles to standalone binaries
- `script/publish.ts` - Publishes platform packages to npm
- `script/postinstall.mjs` - Symlinks correct binary after install
- `bin/patchy` - Wrapper that finds platform binary

> Pattern based on [opencode](https://github.com/sst/opencode) - see their `script/` directory for reference.
