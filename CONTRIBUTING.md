# Contributing to Patchy

## Development Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/richardgill/patchy.git
   cd patchy
   ```

2. Install dependencies:
   ```sh
   bun install
   ```

3. Run the CLI in development mode:
   ```sh
   bun run dev
   ```

   **Tip:** You can run the dev CLI from any directory using `--cwd`:
   ```sh
   bun run --cwd /path/to/patchy dev init
   ```

## Development Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Run the CLI in development mode |
| `bun run build` | Build the TypeScript source |
| `bun run test` | Run the test suite |
| `bun run test-watch` | Run tests in watch mode |
| `bun run check` | Run linting and formatting checks |
| `bun run check-fix` | Fix linting and formatting issues |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run local-ci` | Run all CI checks locally (lint, typecheck, test) |

## Release Process

Patchy uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing. The release process is largely automated via GitHub Actions.

### Adding a Changeset

When you make a change that should be released, add a changeset:

```sh
bun run changeset
```

This will prompt you to:
1. Select the type of change (patch, minor, major)
2. Write a summary of the change

A markdown file will be created in the `.changeset/` directory. Commit this file along with your changes.

**When to add a changeset:**
- Bug fixes → `patch`
- New features (backwards compatible) → `minor`
- Breaking changes → `major`

### Automated Release Flow

When changes with changesets are merged to `main`:

1. **Release PR Created**: The [Changesets GitHub Action](https://github.com/changesets/action) automatically creates/updates a "chore: release" PR that:
   - Consumes all pending changesets
   - Bumps the version in `package.json`
   - Updates `CHANGELOG.md`

2. **Merge the Release PR**: When you're ready to release, merge the release PR. This triggers:

3. **Binary Builds**: Native binaries are built for all platforms:
   - `patchy-linux-x64`
   - `patchy-linux-arm64`
   - `patchy-darwin-x64`
   - `patchy-darwin-arm64`
   - `patchy-windows-x64`

4. **GitHub Release**: A GitHub release is created with:
   - Platform-specific archives (`.tar.gz` for Linux, `.zip` for macOS/Windows)
   - SHA256 checksums
   - Installation instructions

### Installation Methods

Users can install patchy via:

1. **Install script** (recommended):
   ```sh
   curl -fsSL https://raw.githubusercontent.com/richardgill/patchy/main/install | bash
   ```

2. **Direct download**: From the GitHub releases page

### Manual Build

For local testing, you can build binaries manually:

```sh
# Build binary for current platform only
bun run build-single

# Build binaries for all platforms
bun run build
```

### Required Repository Settings

The release workflow requires GitHub Actions to create pull requests. Enable this with:

```sh
gh api repos/OWNER/REPO/actions/permissions/workflow -X PUT \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
```

Or via GitHub UI: Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"

### Required Secrets

The release workflow requires these GitHub repository secrets:
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Code Style

- Use TypeScript with strict mode
- Use `const` for function declarations: `const myFunc = () => ...`
- Use `export const` instead of `export default` unless required by a library
- Use `type` instead of `interface` unless there's a specific reason
- Prefer `??` over `||` for nullish coalescing
- Prefer `Boolean(x)` over `!!x`
