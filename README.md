# patchy

An opinionated command-line tool for managing Git patch workflows.

**patchy** helps you manage patch files for a repository. 


## How it works

Clone a repo you want to apply patches to
```
/home/me/code/my-repo/
└── path/in/repo/existingFile.txt
```

Set up a repo which contains your patches

`patchy init`

```
my-patch-repo/
├── patches/
├── patchy.json                          # optional config
```

Make changes to your repo:

```
/home/me/code/my-repo/
├── path/in/repo/existingFile.txt      # modify this file
└── path/in/repo/newFile.txt           # create a new file
```

Generate patch files `patchy generate --repo-dir /home/me/code/my-repo`

```
my-patch-repo/
├── patches/
│   ├── path/in/repo/existingFile.txt.diff
│   └── path/in/repo/newFile.txt
└── patchy.json
```

Run `patchy apply --repo-dir /home/me/code/my-repo-2`
```
/home/me/code/my-repo-2/
├── path/in/repo/newFile.txt           # copied from patches/
└── path/in/repo/existingFile.txt      # patched file
```


## Installation

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

| CLI Flag          | patchy.json      | Env Variable           | Description                                      |
| ----------------- | ---------------- | ---------------------- | ------------------------------------------------ |
| `--repo-dir`      | `repo_dir`       | `PATCHY_REPO_DIR`      | Path to the Git repo you're patching             |
| `--repo-base-dir` | `repo_base_dir`  | `PATCHY_REPO_BASE_DIR` | Parent directory where upstream repos are cloned |
| `--patches-dir`   | `patches_dir`    | `PATCHY_PATCHES_DIR`   | Path to your patch files (default: `./patches/`) |
| `--config`        |                  | `PATCHY_CONFIG`        | JSON config file (default: `patchy.json`)        |
| `--verbose`       | `verbose`        | `PATCHY_VERBOSE`       | Enable verbose log output                        |
| `--dry-run`       | `dry_run`        | `PATCHY_DRY_RUN`       | Simulate the command without writing files       |

> CLI flags override all values in `patchy.json`.

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

### Precedence Order
 todo :move these to shared options sectionoptions
1. CLI flags
2. Environment variables
3. `--config` (defaults to `./patchy.json`)

## Example Workflow

```sh
# Clone the repo
patchy repo clone --repo-url https://github.com/richardgill/my-repo.git --repo-base-dir ~/code/repos
 todo: update the rest of these commands
# Check out upstream repo at a specific version
patchy repo checkout --ref v1.2.3 

# Generate patches from current state of repo_dir
patchy generate --repo-dir ../clones/upstream

# Later, apply patches cleanly to fresh repo
patchy repo reset --repo-dir ../clones/upstream
patchy repo checkout --ref main --repo-dir upstream
patchy apply --repo-dir ../clones/upstream
```

## License

MIT
