# Example walkthrough

Starting a patch-based fork of https://github.com/octocat/spoon-knife.

## Setup Patchy

Create a folder for the fork: `mkdir spoon-knife-fork && cd spoon-knife-fork`

- [Install Patchy](../README.md#installation)
- Run `patchy init`
  - press enter to select all the default options

`patchy init` creates your config: `./patchy.json` ([full reference](../README.md#patchyjson-reference))
```json5
{
  "source_repo": "https://github.com/octocat/spoon-knife",
  "patches_dir": "./patches/",
  "clones_dir": "./clones/",
  "target_repo": "spoon-knife",
  "base_revision": "d0dd1f61b33d64e29d8bc1372a94ef6a2fee76a9",
  "upstream_branch": "main"
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

## Make changes to the cloned repo

We can now make changes directly in the cloned spoon-knife repo:

```bash
echo "edit existing file" >> clones/spoon-knife/path/to/existingFile.txt
echo "new file" > clones/spoon-knife/path/to/newFile.txt
```

## Generate patches:

To generate the patches for the changes run `patchy generate`:

Patchy will prompt you to create your first **patch set**, let's name it: 'first-patch-set'

```
./
├── clones/
│   └── spoon-knife/
│       ├── path/to/existingFile.txt
│       └── path/to/newFile.txt
├── patches/
│   └── 001-first-patch-set/ (created)
│       ├── path/to/existingFile.txt.diff (generated)
│       └── path/to/newFile.txt (generated)
└── patchy.json
```

- **Edits** are stored as `.diff` files e.g. `existingFile.txt.diff`.
- **New files** are copied as regular files e.g. `newFile.txt` (easier to inspect and edit directly).

## Reapplying patches:

Reset the current upstream repo with `patchy repo reset`, which will reset everything to `base_revision`:

```
./
├── clones/
│   └── spoon-knife/  <<< reset
│       ├── path/to/existingFile.txt
├── patches/
│   └── 001-first-patch-set/
│       ├── path/to/existingFile.txt.diff
│       └── path/to/newFile.txt
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
│   └── 001-first-patch-set/
│       ├── path/to/existingFile.txt.diff
│       └── path/to/newFile.txt
└── patchy.json
```
