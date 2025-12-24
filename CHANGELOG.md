# patchy-cli

## 0.0.17

### Patch Changes

- [#214](https://github.com/richardgill/patchy/pull/214) [`143f340`](https://github.com/richardgill/patchy/commit/143f340c92803357d899a02a80dd56c7840a6613) Thanks [@richardgill](https://github.com/richardgill)! - Fix hooks documentation to show pre-apply before post-apply

## 0.0.16

### Patch Changes

- [#211](https://github.com/richardgill/patchy/pull/211) [`2dbe928`](https://github.com/richardgill/patchy/commit/2dbe928e0256a306e7757d6dba3b73bed596f2c5) Thanks [@richardgill](https://github.com/richardgill)! - Add hooks for patch set lifecycle events (pre-apply and post-apply scripts)

## 0.0.15

### Patch Changes

- [#209](https://github.com/richardgill/patchy/pull/209) [`5ff7529`](https://github.com/richardgill/patchy/commit/5ff75291819d8b13b4498131e0375efe9c162261) Thanks [@richardgill](https://github.com/richardgill)! - Add CI mode detection to prevent interactive prompts from hanging in non-interactive environments. Commands now check for `CI=true` or `CI=1` environment variable and fail with helpful error messages listing required flags instead of waiting for input.

- [#209](https://github.com/richardgill/patchy/pull/209) [`5ff7529`](https://github.com/richardgill/patchy/commit/5ff75291819d8b13b4498131e0375efe9c162261) Thanks [@richardgill](https://github.com/richardgill)! - Refactor getMissingRequiredFlags to use FLAG_METADATA as single source of truth

## 0.0.14

### Patch Changes

- [#206](https://github.com/richardgill/patchy/pull/206) [`bea0b62`](https://github.com/richardgill/patchy/commit/bea0b628803883f16953d8fe13b623dec7287f94) Thanks [@richardgill](https://github.com/richardgill)! - Use kebab-case for boolean flag negations (--no-verbose instead of --noVerbose)

## 0.0.13

### Patch Changes

- [#205](https://github.com/richardgill/patchy/pull/205) [`85f5f1f`](https://github.com/richardgill/patchy/commit/85f5f1f41d7345ed2024b33f61556465a08dad87) Thanks [@richardgill](https://github.com/richardgill)! - Fix release workflow to use custom version script that syncs optionalDependencies

## 0.0.12

### Patch Changes

- [#203](https://github.com/richardgill/patchy/pull/203) [`bcbb5e4`](https://github.com/richardgill/patchy/commit/bcbb5e4b2d03d24579d1e2fac964cc410fd8e20e) Thanks [@richardgill](https://github.com/richardgill)! - Sync optionalDependencies versions automatically during release to prevent stale Dependabot PRs

## 0.0.11

### Patch Changes

- [#201](https://github.com/richardgill/patchy/pull/201) [`907f00c`](https://github.com/richardgill/patchy/commit/907f00c36c2b6369a6fed534c05518ba7071f82a) Thanks [@richardgill](https://github.com/richardgill)! - Improve README documentation with clearer installation command and patch structure explanation

## 0.0.10

### Patch Changes

- [#178](https://github.com/richardgill/patchy/pull/178) [`4e87eb1`](https://github.com/richardgill/patchy/commit/4e87eb12a3043d5072636a549c5656d78e678116) Thanks [@richardgill](https://github.com/richardgill)! - Add commit-per-patch-set feature and improve configuration

  - Replace `ref` config field with `base_revision` and `upstream_branch`
  - Add `patchy base` command to view/update base revision interactively
  - Auto-commit each patch set during `patchy apply` with `--all` and `--edit` flags
  - Enhance `patchy init` with interactive remote ref selection via `git ls-remote`
  - Update `repo clone` and `repo reset` to use `base_revision`
  - Remove `repo checkout` command (use git directly)

## 0.0.9

### Patch Changes

- [#175](https://github.com/richardgill/patchy/pull/175) [`63c882b`](https://github.com/richardgill/patchy/commit/63c882b9b500b03de5dd1cc351b25060a89ded4f) Thanks [@richardgill](https://github.com/richardgill)! - Fix relative `source_repo` paths (e.g., `./upstream`) to resolve from the config file location instead of `clones_dir`

## 0.0.8

### Patch Changes

- [#173](https://github.com/richardgill/patchy/pull/173) [`e7a8011`](https://github.com/richardgill/patchy/commit/e7a80118809fb8ccc2e5417d39d21592d86133e5) Thanks [@richardgill](https://github.com/richardgill)! - Improved README documentation for patch sets ordering and generate command syntax

## 0.0.7

### Patch Changes

- [#170](https://github.com/richardgill/patchy/pull/170) [`f83c1b8`](https://github.com/richardgill/patchy/commit/f83c1b8deddd5690b45825251a97fbba8fe80626) Thanks [@richardgill](https://github.com/richardgill)! - Implement patch sets feature with interactive prompts and metadata support

- [#160](https://github.com/richardgill/patchy/pull/160) [`241c621`](https://github.com/richardgill/patchy/commit/241c621596f0f647c030d98e9704c1ebd63ae2c7) Thanks [@richardgill](https://github.com/richardgill)! - Add support for local file paths in repo_url (absolute paths like `/path/to/repo` and relative paths like `./upstream` or `../sibling`)

- [#167](https://github.com/richardgill/patchy/pull/167) [`55b5fea`](https://github.com/richardgill/patchy/commit/55b5fea925649b8bef4a969efec8eb13c64e669f) Thanks [@richardgill](https://github.com/richardgill)! - Rename `repoUrl` config field to `url` for cleaner configuration

## 0.0.6

### Patch Changes

- [#158](https://github.com/richardgill/patchy/pull/158) [`fc32f94`](https://github.com/richardgill/patchy/commit/fc32f94160a11e4a809f5a83fed9304af945722d) Thanks [@richardgill](https://github.com/richardgill)! - Redesigned README with logo and badges

## 0.0.5

### Patch Changes

- [#156](https://github.com/richardgill/patchy/pull/156) [`ae322ea`](https://github.com/richardgill/patchy/commit/ae322ea5e2e33a1b39b31737d914cf72a5fbf409) Thanks [@richardgill](https://github.com/richardgill)! - Fix JSON schema URL - schema is now included in npm package and accessible via unpkg

## 0.0.4

### Patch Changes

- [`3852722`](https://github.com/richardgill/patchy/commit/3852722159fe0b46f667007b5454403e38e398b7) Thanks [@richardgill](https://github.com/richardgill)! - Small improvements

- [#151](https://github.com/richardgill/patchy/pull/151) [`f3a57b3`](https://github.com/richardgill/patchy/commit/f3a57b382c34990ffacefad99640e440498f6e3d) Thanks [@richardgill](https://github.com/richardgill)! - Fix install script

## 0.0.3

### Patch Changes

- [#147](https://github.com/richardgill/patchy/pull/147) [`b4c8d74`](https://github.com/richardgill/patchy/commit/b4c8d7409bcc1cb5f38b6847b13f8146abeaa941) Thanks [@richardgill](https://github.com/richardgill)! - Initial release

## 0.0.2

### Patch Changes

- [`61657c3`](https://github.com/richardgill/patchy/commit/61657c3b4803d17a752f2d4c6d61d9860a602077) Thanks [@richardgill](https://github.com/richardgill)! - Initial release

## 0.0.1

### Patch Changes

- First official release of Patchy CLI

  A CLI tool for managing Git patch workflows, helping maintain curated patches against upstream repositories.
