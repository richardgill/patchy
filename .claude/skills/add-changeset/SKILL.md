---
name: add-changeset
description: Create a changeset file for versioning and changelog generation. Use when the user asks to add a changeset, bump version, or prepare a release.
---

# Add Changeset

## Instructions

1. If the user does not specify `patch`, `minor`, or `major`, use AskUserQuestion to prompt them:
   - **patch**: Bug fixes, small changes (backwards compatible)
   - **minor**: New features (backwards compatible)
   - **major**: Breaking changes

2. Create a changeset file in `.changeset/` directory with a descriptive name based on the feature or change (e.g., `add-dark-mode.md`, `fix-login-bug.md`, `rename-config-fields.md`)

3. Add a todo at the end to verify the changeset with `bun run changeset status`

## Example Changeset

File: `.changeset/add-export-feature.md`

```markdown
---
"patchy-cli": patch
---

Add CSV export functionality for usage metrics
```

## Changeset Format

```markdown
---
"package-name": patch|minor|major
---

Description of the change (used in CHANGELOG)
```

## Naming Convention

Name changeset files descriptively based on the change:
- `add-dark-mode.md` (new feature)
- `fix-auth-timeout.md` (bug fix)
- `rename-config-fields.md` (refactor)
- `breaking-api-v2.md` (breaking change)

Avoid random/generated filenames.
