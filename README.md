<p align="center">
  <a href="https://github.com/richardgill/patchy">
    <img width="120" src="./assets/logo.png" alt="Patchy logo">
  </a>
</p>
<br/>
<p align="center">
  <a href="https://www.npmjs.com/package/patchy-cli"><img src="https://img.shields.io/npm/v/patchy-cli.svg?label=version" alt="npm package"></a>
  <a href="https://github.com/richardgill/patchy/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/patchy-cli.svg" alt="license"></a>
  <a href="https://github.com/richardgill/patchy/actions/workflows/ci.yml"><img src="https://github.com/richardgill/patchy/actions/workflows/ci.yml/badge.svg?branch=main" alt="build status"></a>
</p>
<br/>

# Patchy 🩹

A CLI for generating and applying patches to git repositories.

## Why Patchy?

For long-lived git forks with no plans to merge upstream:

- A **git fork** stores your changes as commits.
- **Patches** store them as `.diff`

Patch files are a clean way to store long-lived changes - human-readable, easy to review and version. But managing them can be cumbersome.

Patchy makes managing patches easy: make changes to a clone → save them as patches → reapply anytime.

## How it works

`patchy init` sets up your project:

```
├── patchy.json              ← config (source: github.com/org/repo, base: v2.1.0)
├── clones/
│   └── upstream-repo/       ← a clone of the source repo - your working copy
└── patches/                 ← empty for now - your patches live here
```

The workflow:

1. Make changes directly in `clones/upstream-repo/`
2. Run `patchy generate` to generate patches:

```
patches/
└── 001-feature-name/
    ├── src/file.ts.diff     ← edits to existing files
    └── src/newFile.ts       ← new files (no .diff suffix)
```

3. Run `patchy apply` to reapply your patches to `clones/upstream-repo/` anytime

See the [example walkthrough](./docs/example.md) for a step-by-step guide.

## Getting started 

### Installation

```sh
curl -fsSL https://raw.githubusercontent.com/richardgill/patchy/main/install | bash
# follow instructions
patchy
```

Or via npm:


```sh
npm install -g patchy-cli
patchy
```

Or use directly without installing:

```sh
npx patchy-cli@latest
```

### Initialize Patchy

Run this command to initialize Patchy in your project folder:

```sh
patchy init
```

## `patchy.json` reference

```jsonc
{
  // Git URL or local file path to clone from.
  "source_repo": "https://github.com/example/repo.git", // Override: --source-repo | env: PATCHY_SOURCE_REPO
  // Directory containing patch files.
  "patches_dir": "./patches/", // Override: --patches-dir | env: PATCHY_PATCHES_DIR

  // Default directory for cloning repos.
  "clones_dir": "./clones/", // Override: --clones-dir | env: PATCHY_CLONES_DIR

  // Path to repo you're generating patches from or applying patches to.
  // Can be relative to clones_dir: <clones_dir>/<target_repo> or absolute.
  "target_repo": "repo", // Override: --target-repo | env: PATCHY_TARGET_REPO

  // Patch set to generate into (subdirectory of patches_dir).
  // If not set, prompts interactively or errors in non-interactive mode.
  "patch_set": "001-security-fixes", // Override: --patch-set | env: PATCHY_PATCH_SET

  // Git SHA or tag to use as the base for patches.
  "base_revision": "abc123def", // Override: --base-revision | env: PATCHY_BASE_REVISION

  // Remote branch to track for updates (e.g., "main"). Used by `patchy base` to find new commits/tags.
  "upstream_branch": "main" // Override: --upstream-branch | env: PATCHY_UPSTREAM_BRANCH
}
```
Precedence: CLI flags > Environment variables > `patchy.json`

`patchy.json` uses jsonc, so comments are allowed.

## Patch file layout

Patches are stored in the `patches/` directory (customizable via [`patches_dir`](#patchyjson-reference)):

```
./
├── patches/
│   └── 001-first-patch-set/
│       ├── path/to/existingFile.txt.diff
│       └── path/to/newFile.txt
├── clones/
│   └── repo-clone-1/
│       ├── path/to/existingFile.txt (modified)
│       └── path/to/newFile.txt (added)
└── patchy.json
```

Patches are grouped into **patch sets** for organizing related changes. Patch sets have numeric prefixes (e.g., `001-auth`, `002-ui`) and are applied in order.

Within each patch set files follow the same folder structure as in the `source_repo`.

**Two types of patch files:**
- **`.diff` files** — For modified existing files (generated via `git diff HEAD`)
- **Plain files** — For newly added files (copied verbatim for easier inspection and editing)

`patchy generate` automatically removes stale files in `patches/<patch-set>` that no longer correspond to changes in `target_repo`.

## Hooks

Patch sets can include executable scripts that run before and after patches are applied:

```
patches/
└── 001-add-feature/
    ├── patchy-pre-apply   # runs before patches
    ├── src/file.ts.diff
    ├── src/new-file.ts
    └── patchy-post-apply  # runs after patches
```

Patch sets support scripts without diffs, enabling pure automation steps.

### Hook execution

- Hooks run with `cwd` set to `target_repo`
- Environment variables: `PATCHY_TARGET_REPO`, `PATCHY_PATCH_SET`, `PATCHY_PATCHES_DIR`, `PATCHY_PATCH_SET_DIR`, `PATCHY_BASE_REVISION`
- Non-zero exit aborts `patchy apply`
- Hooks must be executable (`chmod +x`)

### Custom hook prefix

```jsonc
{
  "hook_prefix": "my-prefix-"  // Override: --hook-prefix | env: PATCHY_HOOK_PREFIX
}
```

With prefix `my-prefix-`, hooks are named `my-prefix-pre-apply` and `my-prefix-post-apply`.

## Commands

### `patchy generate`

Generate `.diff` files and new files into `./patches/<patch-set>/` based on current `git diff` in `target_repo`.

```sh
patchy generate [--patch-set] [--target-repo] [--patches-dir] [--dry-run]
```

If `--patch-set` is not provided (and not set via env/config), prompts to select an existing patch set or create a new one.

Note: `patchy generate` is destructive and will remove any unneeded files in the patch set directory.

### `patchy apply`

Apply patch files from `patches/` into `target_repo`. Patch sets are applied in alphabetical order.

```sh
patchy apply [--only <patch-set>] [--until <patch-set>] [--auto-commit=<mode>] [--target-repo] [--patches-dir] [--dry-run]
```

| Flag | Description |
|------|-------------|
| `--only <name>` | Apply only the specified patch set |
| `--until <name>` | Apply patch sets up to and including the specified one |
| `--auto-commit=<mode>` | Control auto-commit behavior: `all` (commit everything), `interactive` (prompt on last, default), `skip-last` (leave last uncommitted), `off` (commit nothing) |

### `patchy repo reset`

Hard reset the Git working tree of `target_repo` to `base_revision`. Discards all local changes and patch commits.

```sh
patchy repo reset [--base-revision] [--target-repo]
```

### `patchy repo clone`

Clone a repository into a subdirectory of `clones_dir` and checkout `base_revision`. The target directory is derived from the repo name.

```sh
patchy repo clone [--source-repo] [--clones-dir] [--base-revision]
```

### `patchy base [revision]`

View or update the `base_revision` in config.

```sh
patchy base              # Interactive
patchy base abc123def    # Set base_revision to the specified SHA or tag
```

### `patchy prime`

Prints a prompt you can include in your `AGENTS.md` / `CLAUDE.md`.

Tell your agent to run:
```sh
patchy prime
```

Or include it directly:
```sh
patchy prime >> CLAUDE.md
```

Outputs a brief description of Patchy, key paths, and essential commands to help AI coding agents understand your project's patch workflow.

### `patchy config get <key>`

Output a single config value (raw, no label). Useful for shell scripts.

```sh
patchy config get target_repo_path    # /home/user/project/clones/my-repo
patchy config get patch_set           # 001-feature
patchy config get verbose             # false
```

**Available keys:**

| Key | Description |
|-----|-------------|
| `source_repo` | Git URL or local file path |
| `target_repo` | Repository name or path |
| `clones_dir` | Directory for clones |
| `patches_dir` | Directory for patches |
| `patch_set` | Current patch set name |
| `base_revision` | Base SHA or tag |
| `upstream_branch` | Remote branch to track |
| `hook_prefix` | Hook script prefix |
| `verbose` | Verbose mode ("true"/"false") |
| `clones_dir_path` | Absolute path to clones directory |
| `target_repo_path` | Absolute path to target repository |
| `patches_dir_path` | Absolute path to patches directory |
| `patch_set_path` | Absolute path to current patch set |

- Unknown keys exit with code 1
- Unset raw keys exit with code 1
- Unset computed keys (e.g., `patch_set_path` when `patch_set` is not set) output an empty line

### `patchy config list`

Output all config values as aligned key-value pairs.

```sh
patchy config list
# source_repo       https://github.com/example/repo.git
# target_repo       my-repo
# clones_dir        ./clones
# patches_dir       ./patches
# patch_set         001-feature
# verbose           false
# clones_dir_path   /home/user/project/clones
# target_repo_path  /home/user/project/clones/my-repo
# ...
```

Only defined values are shown. Computed path values are resolved to absolute paths.

## License

MIT
