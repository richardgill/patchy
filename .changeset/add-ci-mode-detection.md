---
"patchy-cli": patch
---

Add CI mode detection to prevent interactive prompts from hanging in non-interactive environments. Commands now check for `CI=true` or `CI=1` environment variable and fail with helpful error messages listing required flags instead of waiting for input.
