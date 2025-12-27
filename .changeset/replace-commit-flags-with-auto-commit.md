---
"patchy-cli": patch
---

Replace `--all` and `--edit` flags with `--auto-commit` enum flag

**Breaking Changes:**
- `--all` flag removed, use `--auto-commit=all` instead
- `--edit` flag removed, use `--auto-commit=skip-last` instead

(pre release so doing a patch release)

**New `--auto-commit` modes:**
- `all` - Commit all patch sets automatically
- `interactive` (default) - Auto-commit intermediate, prompt on last (falls back to `all` if no TTY)
- `skip-last` - Auto-commit all except last, leave final uncommitted
- `off` - Don't commit anything
