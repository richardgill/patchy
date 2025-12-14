# patchy

An opinionated command-line tool for managing Git patch workflows. 

## How it works

Patchy helps you manage `.diff` patches for a repository you want to modify.

`patchy.json` (see [full config reference](#patchyjson) below)
```json5
{
  "repo_url": "https://github.com/octocat/spoon-knife",
  "patches_dir": "./patches/",
  "clones_dir": "./clones/",
  "repo_dir": "spoon-knife",
}
```

Initialize Patchy with:
```bash
patchy init
```

You can `patchy repo clone` the repo into `./clones/` to complete the setup.

Now you'll have

```
./
├── patches/
├── clones/
│   └── spoon-knife/
│       ├── path/to/existingFile.txt
└── patchy.json
```

Now you can make changes directly to `./clones/spoon-knife`

And generate patches with `patchy generate`

```
./
├── clones/
│   └── spoon-knife/
│       ├── path/to/existingFile.txt
│       └── path/to/newFile.txt
├── patches/
│   ├── path/to/existingFile.txt.diff
│   └── path/to/newFile.txt
└── patchy.json
```

- **Edits** are stored as `.diff` files e.g. `existingFile.txt.diff`.
- **New files** are copied as regular files e.g. `newFile.txt`. 

You can reapply your changes later with:

`patchy apply`

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
# follow instructions
patchy
```

Or via npm:


```sh
npm install -g patchy-cli
patchy-cli
```

Or use directly without installing:

```sh
npx patchy-cli@latest
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
