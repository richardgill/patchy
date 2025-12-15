<p align="center">
  <a href="https://github.com/richardgill/patchy">
    <img width="180" src="./assets/logo.png" alt="Patchy logo">
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

> A CLI for generating and applying patches to git repositories.

## Patches vs forks

A traditional fork means maintaining a separate repository or long-lived branch. Over time, your history diverges from upstream, which can make updates painful.

With patches, you store changes as `.diff` files alongside the upstream repo. You can inspect them, edit them, and apply them to a fresh clone of the repo.

## What is Patchy?

Patchy helps you **generate** and **apply** `.diff` patches for a git repo you've cloned on your machine.

It's opinionated and has [conventions](#patch-file-layout) about how the `.diff` files are stored.

## Example

Starting a patch-based fork of https://github.com/octocat/spoon-knife.

### Setup Patchy

Create a folder for the fork: `mkdir spoon-knife-fork && cd spoon-knife-fork`

- [Install Patchy](#install)
- Run `patchy init`
  - press enter to select all the default options

`patchy init` creates your config: `./patchy.json` ([full reference](#patchyjson))
```json5
{
  "repo_url": "https://github.com/octocat/spoon-knife",
  "patches_dir": "./patches/",
  "clones_dir": "./clones/",
  "repo_dir": "spoon-knife",
  "ref": "main"
}
```

`patchy init` also creates an empty `./patches` folder and clones the spoon-knife repo into `./clones`:

```
./
├── patches/
├── clones/
│   └── spoon-knife/
│       └── path/to/existingFile.txt
└── patchy.json
```

### Make changes to the cloned repo

We can now make changes directly in the cloned spoon-knife repo:

```bash
echo "edit existing file" >> clones/spoon-knife/path/to/existingFile.txt 
echo "new file" > clones/spoon-knife/path/to/newFile.txt 
```

### Generate patches:

To generate the patches for the changes run `patchy generate`:


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
- **New files** are copied as regular files e.g. `newFile.txt` (easier to inspect and edit directly). 

### Reapplying patches:

Reset the current upstream repo `patchy repo reset main`, which will reset everything to `main`:

```
./
├── clones/
│   └── spoon-knife/  <<< reset
│       ├── path/to/existingFile.txt
├── patches/
│   ├── path/to/existingFile.txt.diff
│   └── path/to/newFile.txt
└── patchy.json
```

Apply the patches back to the cloned repo with: `patchy apply`

```
./
├── clones/
│   └── spoon-knife/
│       ├── path/to/existingFile.txt (modified)
│       └── path/to/newFile.txt (added)
├── patches/
│   ├── path/to/existingFile.txt.diff
│   └── path/to/newFile.txt
└── patchy.json
```

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

### Initialize Patchy

Run this command to initialize Patchy in your project folder:

```sh
patchy init
```

## `patchy.json` reference

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

`patchy.json` use jsonc, so comments are allowed.

## Patch file layout

The `patches/` directory (customizable via [`patches_dir`](#patchyjson)) uses the same folder structure as `repo_dir`:

```
./
├── patches/
│   ├── path/to/existingFile.txt.diff
│   └── path/to/newFile.txt
├── clones/
│   └── repo-clone-1/
│       ├── path/to/existingFile.txt (modified)
│       └── path/to/newFile.txt (added)
└── patchy.json
```

**Two types of patch files:**
- **`.diff` files** — For modified existing files (generated via `git diff HEAD`)
- **Plain files** — For newly added files (copied verbatim for easier inspection and editing)

`patchy generate` automatically removes stale files in `patches/` that no longer correspond to changes in `repo_dir`.

## Commands

### `patchy generate`

Generate `.diff` files and new files into `./patches/` based on current `git diff` in `repo_dir`.

```sh
patchy generate [--repo-dir] [--patches-dir] [--dry-run]
```

Note: `patchy generate` is destructive and will remove any unneeded files in your `./patches/` folder.

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
