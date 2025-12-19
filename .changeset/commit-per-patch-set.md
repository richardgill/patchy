---
"patchy-cli": patch
---

Add commit-per-patch-set feature and improve configuration

- Replace `ref` config field with `base_revision` and `upstream_branch`
- Add `patchy base` command to view/update base revision interactively
- Auto-commit each patch set during `patchy apply` with `--all` and `--edit` flags
- Enhance `patchy init` with interactive remote ref selection via `git ls-remote`
- Update `repo clone` and `repo reset` to use `base_revision`
- Remove `repo checkout` command (use git directly)
