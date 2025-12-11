# patchy

Make edits to a repo, use `patchy generate` to export them as patches, then `patchy apply` to restore those edits on a fresh clone.

```
Generate patches:  ~/my-repo-1 (with edits)  ──▶  patchy generate  ──▶  patches/my-change.diff
Apply patches:     patches/                  ──▶  patchy apply     ──▶  ~/my-repo-2 (edits applied)
```

## How it works


Clone a repo you want to apply patches to

```bash
git clone https://github.com/example/my-repo.git ~/my-repo
```

```
~/my-repo/
└── path/in/repo/existingFile.txt
```
Make patch changes to the repo:

```
~/my-repo/
├── path/in/repo/existingFile.txt      # modify this file
└── path/in/repo/newFile.txt           # create a new file
```

Set up a repo which contains your patches

```bash
cd my-patch-repo && patchy init
```

```
my-patch-repo/
├── patches/
├── patchy.json
```


Generate patch files 

```bash
patchy generate --repo-dir ~/my-repo
```

```
my-patch-repo/
├── patches/
│   ├── path/in/repo/existingFile.txt.diff
│   └── path/in/repo/newFile.txt
└── patchy.json
```

Apply the patches to the repo

```bash
patchy apply --repo-dir ~/my-repo-2
```

```
~/my-repo-2/
├── path/in/repo/newFile.txt           # copied from patches/
└── path/in/repo/existingFile.txt      # patched file
```

## Installation

```sh
curl -fsSL https://raw.githubusercontent.com/richardgill/patchy/main/install | bash
```

Or via npm:

```sh
npm install -g patchy-cli
```

## Initialize patches

Run this command to initialize a new patch project:

```sh
patchy init
```

This will set up the necessary directory structure and configuration file for your patch workflow.


## Shared Options

These options are accepted by **all commands**:

| patchy.json      | CLI Flag          | Env Variable           | Description                                      |
| ---------------- | ----------------- | ---------------------- | ------------------------------------------------ |
| `repo_dir`       | `--repo-dir`      | `PATCHY_REPO_DIR`      | Path to the Git repo you're patching             |
| `repo_base_dir`  | `--repo-base-dir` | `PATCHY_REPO_BASE_DIR` | Parent directory where upstream repos are cloned |
| `patches_dir`    | `--patches-dir`   | `PATCHY_PATCHES_DIR`   | Path to your patch files (default: `./patches/`) |
|                  | `--config`        | `PATCHY_CONFIG`        | JSON config file (default: `patchy.json`)        |
| `verbose`        | `--verbose`       | `PATCHY_VERBOSE`       | Enable verbose log output                        |
| `dry_run`        | `--dry-run`       | `PATCHY_DRY_RUN`       | Simulate the command without writing files       |

Precedence order (highest to lowest):
1. CLI flags
2. Environment variables
3. `patchy.json`

## Commands

### `patchy apply`

Apply patch files from `patches/` into `repo_dir`.

```sh
patchy apply [--repo-dir] [--patches-dir] [--dry-run]
```

### `patchy generate`

Generate `.diff` files and new full files into `./patches/` based on current `git diff` in `repo_dir`.

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

## Configuration (`patchy.json`)

Optional file to set default values:

```json
{
  "repo_url": "https://github.com/richardgill/upstream.git",
  "repo_dir": "upstream-repo",
  "repo_base_dir": "../clones",
  "patches_dir": "patches/",
  "ref": "main"
}
```

All options may be set with environment variables as well e.g. `PATCHY_REPO_URL`.

## Example Workflow


```sh
# Clone the repo
patchy repo clone --repo-url https://github.com/richardgill/my-repo.git --repo-base-dir ~/repos

# Check out at a specific version
patchy repo checkout --ref v1.2.3 --repo-dir ~/repos/my-repo

# Make changes to the repo, then generate patches
patchy generate --repo-dir ~/repos/my-repo

# Later, apply patches to a fresh clone
patchy repo reset --repo-dir ~/repos/my-repo
patchy repo checkout --ref main --repo-dir ~/repos/my-repo
patchy apply --repo-dir ~/repos/my-repo
```

## License

MIT
