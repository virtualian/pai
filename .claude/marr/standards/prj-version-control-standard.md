---
marr: standard
version: 1
title: Version Control Standard
scope: All git operations, branching, commits, and GitHub configuration

triggers:
  - WHEN working with git branches, commits, or merges
  - WHEN creating or reviewing pull requests
  - WHEN configuring repository settings
  - WHEN auditing version control compliance
---

# Version Control Standard

> **AI Agent Instructions**: This document defines git mechanics and GitHub configuration. Follow these rules for all version control operations.

---

## Core Rules (NEVER VIOLATE)

1. **NEVER make code changes on the main branch** because main must always be deployable
2. **Always squash merge** because linear history is easier to understand and debug
3. **Delete merged branches** because clean repos prevent confusion
4. **Branch from main only** (except hotfixes from production tags)
5. **Use issue-based branch naming** because traceability matters
6. **Run tests before pushing** because broken code should never reach the remote

---

## Branching Strategy

**Model:** Trunk-based development with short-lived feature branches.

**Rules:**
- All feature work happens on branches
- Branches live maximum 5 days
- Only main is long-lived
- Hotfixes branch from production tags

---

## Branch Naming Convention

**Standard Format:** `<issue-number>-<descriptive-name>`

**Examples:**
- `42-user-profile-view` (feature work)
- `67-fix-login-timeout` (bug fix)
- `89-update-dependencies` (maintenance task)

**Exception — Hotfixes:** `hotfix/<issue-number>-<description>` (see Development Workflow Standard for hotfix process)

---

## Commit Message Format

**Format:** Clean, descriptive subject line (50 chars max) with optional body

**Rules:**
- NO issue numbers in commit messages — branch names provide traceability
- Use imperative mood ("Add feature" not "Added feature")
- Explain WHAT and WHY, not HOW
- Keep subject line under 50 characters
- Wrap body at 72 characters

**Examples:**
```
Add user authentication flow

Implement OAuth2 with refresh tokens to support
long-lived sessions without requiring re-login.
```

```
Fix memory leak in connection pool
```

---

## Merge Strategy

**Required:** Squash merge only.

**Rationale:**
- Creates linear, readable history
- Each merge = one logical change
- Easy to revert entire features
- Clean bisect for debugging

**Forbidden:**
- Merge commits (creates non-linear history)
- Rebase merge (loses squash benefits)

---

## Pull Request Requirements

**Before Creating PR:**
- [ ] Branch is up to date with main
- [ ] All commits are meaningful (will be squashed)
- [ ] Self-review completed

**PR Checklist:**
- [ ] Clear title describing the change
- [ ] Description explains WHAT and WHY
- [ ] Links to issue number
- [ ] No merge conflicts

**Before Merging:**
- [ ] CI checks pass (if configured)
- [ ] No merge conflicts with main
- [ ] Squash merge selected

---

## Enforcement Status

Transparency about what is technically enforced vs trust-based:

| Rule | Enforcement | Notes |
|:-----|:------------|:------|
| Squash merge only | GitHub setting | Configure: disable merge commits |
| No direct push to main | Branch protection | Requires GitHub Pro/Team |
| Required reviews | Branch protection | Requires GitHub Pro/Team |
| CI checks pass | GitHub Actions | Only if CI configured |
| Auto-delete branches | GitHub setting | Recommend enabling |
| Issue-based naming | Trust-based | Agent/developer discipline |
| 5-day branch lifetime | Trust-based | Agent/developer discipline |
| Commit message format | Trust-based | Agent/developer discipline |

---

## GitHub Repository Configuration

**Recommended Settings** (Settings → General → Pull Requests):

| Setting | Recommended | Rationale |
|:--------|:------------|:----------|
| Allow squash merging | ✅ ON | Required merge strategy |
| Allow merge commits | ❌ OFF | Prevents non-linear history |
| Allow rebase merging | ❌ OFF | Prevents bypass of squash |
| Auto-delete head branches | ✅ ON | Keeps repo clean |

**Audit Command:**
```bash
gh api repos/{owner}/{repo} --jq '{
  squash: .allow_squash_merge,
  merge: .allow_merge_commit,
  rebase: .allow_rebase_merge,
  auto_delete: .delete_branch_on_merge
}'
```

---

## Release & Tagging

Production releases are created exclusively via tags on the main branch.

**Tag Naming Convention:** `vX.Y.Z` (e.g., `v1.0.0`, `v2.3.1`)

**Manual Release Process:**
1. Ensure you are on main branch: `git checkout main`
2. Pull latest: `git pull`
3. Verify clean working directory: `git status`
4. Verify tests pass
5. Update version in project files (e.g., `package.json`)
6. Commit version bump: `git commit -am "vX.Y.Z"`
7. Create annotated tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
8. Push commit and tag: `git push && git push --tags`

**Rules:**
- Tags are immutable — never delete or move a release tag
- Only tag from main branch
- Version bump commit should contain only version changes
- Use annotated tags (`-a`), not lightweight tags

---

## Anti-Patterns (FORBIDDEN)

- **Making changes on main** — All code changes must be on a feature branch
- **Merge commits** — Always squash merge
- **Long-lived branches** — Merge or close within 5 days
- **Branching from branches** — Branch from main only (except hotfixes)
- **Force pushing to shared branches** — Coordinate with collaborators first
- **Skipping CI checks** — All checks must pass before merge
- **Issue numbers in commits** — Branch names provide traceability
- **Pushing without running tests** — Verify locally before pushing

---

**This standard ensures clean, traceable version control practices.**
