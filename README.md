# patchy

An opinionated command-line tool for managing Git patch workflows.

**patchy** helps you maintain a curated set of patches—both added files and diffs—against an upstream Git repository.

## Directory Structure

```
my-patch-repo/
├── patches/
│   ├── path/in/repo/newFile.ts          # new file
│   ├── path/in/repo/oldFile.ts.diff     # diff file
├── patchy.yaml                          # optional config

repo-dir/
├── path/in/repo/newFile.ts              # generated/copied
├── path/in/repo/oldFile.ts              # original file, to be patched
```

File layout must mirror the structure of `repo_dir`.

---

## Installation

```sh
bunx patchy
```

---

## Shared Flags

These flags are accepted by **all commands**:

| Flag            | Description                                    |
| --------------- | ---------------------------------------------- |
| `--repo-dir`    | Path to the Git repo you're patching           |
| `--patches-dir` | Path to your patch files (default: `patches/`) |
| `--config`      | YAML config file (default: `patches.yaml`)     |
| `--verbose`     | Enable verbose log output                      |
| `--dry-run`     | Simulate the command without writing files     |

> CLI flags override all values in `patches.yaml`.

---

## Commands

### `patchy apply`

Apply patch files from `patches/` into `repo_dir`.

```sh
bunx patchy apply [--repo-dir] [--patches-dir] [--dry-run]
```

---

### `patchy generate`

Generate `.diff` files and new full files into `patches/` based on current dirty changes in `repo_dir`.

```sh
bunx patchy generate [--repo-dir] [--patches-dir] [--dry-run]
```

---

### `patchy repo reset`

Hard reset the Git working tree of `repo_dir`. Discards local changes.

```sh
bunx patchy repo reset [--repo-dir]
```

---

### `patchy repo checkout --ref <git-ref>`

Check out a specific Git ref (branch, tag, or SHA) in `repo_dir`.

```sh
bunx patchy repo checkout --ref main [--repo-dir]
```

---

## Configuration (`patchy.yaml`)

Optional file to set default values:

```yaml
repo_dir: ../upstream-repo
patches_dir: patches/
default_ref: main
```

### Precedence Order

1. CLI flags
2. `--config` file
3. Default `patches.yaml`

---

## Example Workflow

```sh
# Check out upstream repo at a specific version
bunx patchy repo checkout --ref v1.2.3

# Generate patches from current state of repo_dir
bunx patchy generate

# Later, apply patches cleanly to fresh repo
bunx patchy repo reset
bunx patchy repo checkout --ref main
bunx patchy apply
```

---

## License

MIT
