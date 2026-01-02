---
"patchy-cli": patch
---

Add conflict marker support when patches fail to apply cleanly. The new `--on-conflict` flag controls behavior: `markers` (default) inserts git-style conflict markers allowing manual resolution, `error` fails immediately (previous behavior).
