# patchy

An opinionated command-line tool for managing Git patch workflows.

**patchy** helps you maintain a curated set of patches—both added files and diffs—against an upstream Git repository.

## Quick Start

Run this command to initialize a new patch project:

```sh
patchy init
```

This will set up the necessary directory structure and configuration file for your patch workflow.

## Directory Structure

```
my-patch-repo/
├── patches/
│   ├── path/in/repo/newFile.ts          # new file
│   ├── path/in/repo/oldFile.ts.diff     # diff file
├── patchy.yaml                          # optional config

repo-dir/
├── path/in/repo/newFile.ts              # will be copied from patches/
├── path/in/repo/oldFile.ts              # original file, to be patched
```

File layout must mirror the structure of `repo_dir`.

## Installation

```sh
npm install -g @richardgill/patchy
```

## Shared Flags

These flags are accepted by **all commands**:

| Flag              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `--repo-dir`      | Path to the Git repo you're patching             |
| `--repo-base-dir` | Parent directory where upstream repos are cloned |
| `--patches-dir`   | Path to your patch files (default: `./patches/`)   |
| `--config`        | YAML config file (default: `patchy.yaml`)        |
| `--verbose`       | Enable verbose log output                        |
| `--dry-run`       | Simulate the command without writing files       |

> CLI flags override all values in `patchy.yaml`.

## Commands

### `patchy apply`

Apply patch files from `patches/` into `repo_dir`.

```sh
patchy apply [--repo-dir] [--patches-dir] [--dry-run]
```

### `patchy generate`

Generate `.diff` files and new full files into `./patches/` based on current dirty changes in `repo_dir`.

```sh
patchy generate [--repo-dir] [--patches-dir] [--dry-run]
```

### `patchy repo reset`

Hard reset the Git working tree of `repo_dir`. Discards local changes.

```sh
patchy repo reset [--repo-dir]
```

### `patchy repo checkout --ref <git-ref>`

Check out a specific Git ref (branch, tag, or SHA) in `repo_dir`.

```sh
patchy repo checkout --ref main [--repo-dir]
```

### `patchy repo clone --url <git-url>`

Clone a repository into a subdirectory of `repo_base_dir`. The target directory is derived from the repo name.

```sh
patchy repo clone [--repo-base-dir] [--ref] [--repo-url] 
```

## Configuration (`patchy.yaml`)

Optional file to set default values:

```yaml
repo_url: https://github.com/richardgill/upstream.git
repo_dir: upstream-repo
repo_base_dir: ../clones
patches_dir: patches/
ref: main
```

### Precedence Order

1. CLI flags
2. `--config` (defaults to `./patchy.yaml`)

## Example Workflow

```sh
# Clone the upstream repo
patchy repo clone --repo-url https://github.com/richardgill/upstream.git --repo-base-dir ../clones

# Check out upstream repo at a specific version
patchy repo checkout --ref v1.2.3 --repo-dir ../clones/upstream

# Generate patches from current state of repo_dir
patchy generate --repo-dir ../clones/upstream

# Later, apply patches cleanly to fresh repo
patchy repo reset --repo-dir ../clones/upstream
patchy repo checkout --ref main --repo-dir upstream
patchy apply --repo-dir ../clones/upstream
```

## License

MIT
