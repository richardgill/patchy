# patchy

An opinionated command-line tool for managing Git patch workflows.

## How it works

1. Clone repo → `~/target-1`
2. Make some edits (the patches!)
3. Create a repo for your patches → `~/my-patches`
3. `patchy generate --repo ~/target-1` → Creates `~/my-patches/patches/*.diff`

Then reapply your changes later with:

5. `patchy apply --repo ~/target-1` → `~/target-1` (patches applied)


### `patches/` folder structure

Patch files are stored in the same folder structure as the target repo:

```
~/target-1/
└── path/in/repo/existingFile.txt
```

```
my-patch-repo/
├── patches/
│   ├── path/in/repo/existingFile.txt.diff
│   └── path/in/repo/newFile.txt
└── patchy.json
```

- **Edits** are stored as `.diff` files e.g. `existingFile.txt.diff`.
- **New files** are stored as regular files e.g. `newFile.txt`. 

### `patchy.json`

```jsonc
{
  // Git URL to clone from.
  "repo_url": "https://github.com/example/repo.git", // Override: --repo-url | env: PATCHY_REPO_URL

  // Path to repo you're generating patches from or applying patches to.
  "repo_dir": "~/repos/repo", // Override: --repo-dir | env: PATCHY_REPO_DIR

  // Directory containing patch files.
  "patches_dir": "./patches/", // Override: --patches-dir | env: PATCHY_PATCHES_DIR

  // Parent directory for cloning repos. You can easily clone more repos here from repo_url.
  "clones_dir": "./clones/", // Override: --clones-dir | env: PATCHY_CLONES_DIR

  // Git ref to checkout (branch, tag, SHA).
  "ref": "main" // Override: --ref | env: PATCHY_REF
}
```

Precedence: CLI flags > Environment variables > `patchy.json`

## Getting started 

### Installation

```sh
curl -fsSL https://raw.githubusercontent.com/richardgill/patchy/main/install | bash
```

Or via npm:

**Install script (recommended):**

```sh
curl -fsSL https://raw.githubusercontent.com/richardgill/patchy/main/install | bash
```

**Via npm:**

```sh
npm install -g patchy-cli
```

Or use directly without installing:

```sh
npx patchy-cli --version
```

### Initialize patchy

Run this command to initialize patchy in your project:

```sh
patchy init
```

## Commands

### `patchy generate`

Generate `.diff` files and new files into `./patches/` based on current `git diff` in `repo_dir`.

```sh
patchy generate [--repo-dir] [--patches-dir] [--dry-run]
```

### `patchy apply`

Apply patch files from `patches/` into `repo_dir`.

```sh
patchy apply [--repo-dir] [--patches-dir] [--dry-run]
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

Clone a repository into a subdirectory of `clones_dir`. The target directory is derived from the repo name.

```sh
patchy repo clone [--clones-dir] [--ref] [--repo-url] 
```

## License

MIT
