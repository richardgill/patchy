# patchy

An opinionated command-line tool for managing Git patch workflows. 

## How it works

Patchy helps you manage `.diff` patches for a repository you want to modify.

`patchy.json` (see [full config reference](#patchyjson) below)
```json5
{
  "upstream_url": "https://github.com/octocat/spoon-knife",
  "patches_dir": "./patches/",
  "clones_dir": "./clones/",
  "upstream_dir": "spoon-knife",
}
```

Initialize Patchy with:
```bash
patchy init
```

You can `patchy upstream clone` the repo into `./clones/` to complete the setup.

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
  "upstream_url": "https://github.com/example/repo.git", // Override: --upstream-url | env: PATCHY_UPSTREAM_URL

  // Path to repo you're generating patches from or applying patches to.
  "upstream_dir": "~/repos/repo", // Override: --upstream-dir | env: PATCHY_UPSTREAM_DIR

  // Directory containing patch files.
  "patches_dir": "./patches/", // Override: --patches-dir | env: PATCHY_PATCHES_DIR

  // Parent directory for cloning repos. You can easily clone more repos here from upstream_url.
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

Generate `.diff` files and new files into `./patches/` based on current `git diff` in `upstream_dir`.

```sh
patchy generate [--upstream-dir] [--patches-dir] [--dry-run]
```

### `patchy apply`

Apply patch files from `patches/` into `upstream_dir`.

```sh
patchy apply [--upstream-dir] [--patches-dir] [--dry-run]
```

### `patchy upstream reset`

Hard reset the Git working tree of `upstream_dir`. Discards local changes.

```sh
patchy upstream reset [--upstream-dir]
```

### `patchy upstream checkout --ref <git-ref>`

Check out a specific Git ref (branch, tag, or SHA) in `upstream_dir`.

```sh
patchy upstream checkout --ref main [--upstream-dir]
```

### `patchy upstream clone --url <git-url>`

Clone a repository into a subdirectory of `clones_dir`. The target directory is derived from the repo name.

```sh
patchy upstream clone [--clones-dir] [--ref] [--upstream-url] 
```

## License

MIT
