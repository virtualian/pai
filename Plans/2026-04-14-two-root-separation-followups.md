# Two-Root Separation Followups — Planning Doc

> **Date:** 2026-04-14
> **Status:** Investigation complete. Implementation not started.
> **Scope:** Repo-only edits. No runtime modifications. No migration shim.
> **Audience:** Future Claude conversations picking up issues #108, #109, #110, #115 individually.

---

## Why this doc exists

The investigation that filed issues #108, #109, #110, and #115 surfaced findings, decisions, and constraints that don't fit cleanly into any single issue. Rather than spread context across long conversations, this doc consolidates the planning state so that each issue can be picked up in a fresh conversation by reading: (a) the issue body, (b) the issue's update comments, (c) this doc.

If you are a fresh conversation handed one of these issues — read this doc first, then read the issue, then proceed.

---

## The problem in one paragraph

PR #101 declared a two-root architecture (`CLAUDE_CONFIG_DIR=~/.claude/` for Claude Code harness state; `PAI_DIR=~/.pai/` for PAI's CODE root) and rewrote 749 path references across 185 files to match. The declaration was string-level only — the runtime loaders, the installer, the Learning skill workflows, and Claude Code's own skill scanner did not change to match. Three subsystems still operate on the pre-separation paths:

1. **`~/.claude/PAI/` mirror tree** still exists alongside `~/.pai/PAI/` with content drift; canonical files contain residual `~/.claude/PAI/` strings; `RebuildPAI.ts:16` has hardcoded `~/.claude/PAI` in executable code (#108)
2. **Learning skill `Apply.md`** points at a phantom AISTEERINGRULES path, reads from the stale `~/.claude/PAI/` Algorithm tree, and labels Claude Code per-cwd auto-memory as "PAI memory directory" (#109)
3. **Claude Code's skills loader** is hardcoded to scan `~/.claude/skills/`; PAI cannot redirect it without symlinks, an `--add-dir` launch flag, or an upstream Claude Code feature (#110)

A fourth issue — the installer hardcodes `danielmiessler/PAI` as the clone source so fork edits never reach runtime via reinstall (#115) — was discovered while investigating regression risk for #108–#110 and is a contributing cause of all three.

---

## The 5 issues at a glance

| Issue | Title | Tonight's scope | Blocking decisions |
|---|---|---|---|
| **#98** | Separate PAI installation from CC config: CLAUDE_CONFIG_DIR + PAI_DIR | Parent — closes when children land | None |
| **#108** | Stale `~/.claude/PAI/` mirror + residual strings + ambiguous CLAUDE.md Algorithm load | **In scope** — surgical string edits in repo only | None — surgical-only decided (see below) |
| **#109** | Learning skill writes feedback to Claude Code auto-memory mislabeled as "PAI memory directory" + reads from stale tree + phantom AISTEERINGRULES path | **In scope** — Apply.md edits in repo only | **Path A vs Path B for feedback memory home** (see below) |
| **#110** | Skills separation is documentation-only; harness reads `~/.claude/skills/`, not `~/.pai/skills/` | **Deferred** — needs design phase first | Ownership manifest; Option B vs D vs combined; coordination with #115 |
| **#115** | Installer hardcodes upstream `danielmiessler/PAI` clone URL; fork edits never reach runtime via reinstall | **Deferred** — needs design phase first | None — but blocks the practical impact of #108 and #110 fixes for fork users |

---

## Tonight's scope decision

**Implement #108 + #109 only. Defer #110 and #115.**

Rationale:

- **#108 + #109 are surgical string edits** with clear evidence and well-defined scope. Both can be expressed as small focused PRs against the repo.
- **#110 needs a design phase first** — choosing Option B (per-pack symlinks) vs Option D (upstream Claude Code `skillsPaths` feature request) vs a combined approach, and building an ownership manifest that distinguishes PAI-pack-owned skill subdirectories from third-party / user-installed ones (e.g. `tts-tutor-skill`).
- **#115 is independent of #108 + #109** but has its own design surface (env var? settings.json field? CLI flag? auto-detect existing fork remote?) that's worth its own thread.
- **#110 and #115 are coupled** — fixing #110 in a fork won't reach users until #115 is also fixed, because the fork-side installer changes never get cloned into a user's `~/.claude/`.

---

## Constraints for the implementation work

These constraints were set by the user during the investigation session and apply to anyone picking up #108 or #109:

1. **Repo-only edits.** No modifications to runtime (`~/.claude/` or `~/.pai/`). The runtime is being managed separately and is currently in flux on this machine (see "Runtime state on this machine" below).
2. **No migration shim.** The user explicitly does not want a separate migration script. Edits go in the repo; how they reach runtime is a separate later problem.
3. **No commits without explicit user approval.** Per MARR `prj-version-control-standard.md` and the AI Steering Rules. Working-tree edits are fine; `git commit`, `git push`, and `gh pr create` require an explicit go from the user, not implicit consent from the issue being filed.
4. **Branch strategy.** Use a feature branch per issue (or paired-issue branch). Suggested names: `fix/108-residual-claude-pai-paths`, `fix/109-learning-skill-feedback-paths`. Confirm with user before creating.

---

## Open design decisions

### #109 — Path A vs Path B for feedback memory home

The Apply.md mislabel fix forks based on this design call. **Decision needed before any edits to Apply.md:70 or Apply.md:82.**

| | **Path A** | **Path B** |
|---|---|---|
| Approach | Keep using Claude Code per-cwd auto-memory at `~/.claude/projects/<cwd-slug>/memory/`. Rename "PAI memory directory" label in Apply.md to "Claude Code project memory". Document the per-cwd silo as intended behavior. | Build a PAI-native feedback directory at `~/.pai/MEMORY/FEEDBACK/`. Update Apply.md to point there. Migrate existing files. May require loader code in PAI hooks. May require changes to /Learn synthesis workflow. |
| Effort | ~30 min, single small PR | Several hours, multiple touch points |
| Per-cwd silo | Yes (documented as intended) | No (global feedback) |
| Coupling to Claude Code | High | None |
| Architectural cleanliness | Compromise | Correct |
| Risk | Low | Medium |
| Resolves #97? | No | Partially |

**Recommendation framing:** If the priority is "close the bug surface fast" → A. If the priority is "finish the PAI memory architecture properly" → B. They are not stepping stones; switching from A to B later requires undoing the documentation work.

**Independent of A vs B:** Apply.md:68 (Algorithm spec read path) and Apply.md:69 (phantom AISTEERINGRULES path) can be fixed regardless. Only Apply.md:70 and Apply.md:82 depend on this decision.

### #110 — Skills separation strategy

Four options documented in the issue body. **Recommendation: Option B (per-pack symlinks) for short-term + Option D (upstream Claude Code `skillsPaths` feature request) for long-term.** Decision deferred until separate design phase.

### #115 — Installer URL configurability

Three suggested approaches in the issue body. **No recommendation yet.** Decision deferred.

---

## Per-issue work plans

### #108 — Implementation plan

**Files to edit (all in repo):**

| File | Change |
|---|---|
| `Releases/v4.0.3+/.claude/PAI/Algorithm/v3.7.0.md` lines 38, 136, 203, 424 | Replace 4 residual `~/.claude/PAI/` references with `${PAI_DIR}/PAI/` or equivalent |
| `Releases/v4.0.3+/.claude/PAI/Tools/RebuildPAI.ts:16` | Replace `const PAI_DIR = join(HOME, ".claude/PAI");` with `PAI_DIR` env var resolution |
| `Releases/v4.0.3+/.claude/PAI/Tools/Notify.ts` (header comment) | Update doc-comment path |
| `Releases/v4.0.3+/.claude/PAI/Tools/SecretScan.ts` (header comment) | Update doc-comment path |
| `Releases/v4.0.3+/.claude/PAI/Tools/SessionProgress.ts` (header comment) | Update doc-comment path |
| `Releases/v4.0.3+/.claude/PAI/Tools/LoadSkillConfig.ts` (header + doc) | Update doc-comment path |
| `Releases/v4.0.3+/.claude/PAI/Tools/templates/LOCAL_PATCHES-TEMPLATE.md` | Update doc path examples |
| `Releases/v4.0.3+/.claude/PAI/CLI.md` | Replace `~/.claude/PAI/Tools/algorithm.ts` reference |
| `Releases/v4.0.3+/.claude/PAI/FLOWS.md` | Replace 4 `~/.claude/PAI/` references |
| `Releases/v4.0.3+/.claude/PAI/DOCUMENTATIONINDEX.md` | Replace "All documentation files are in `~/.claude/PAI/`" line |

**Critical: do NOT reconcile the 102-line Algorithm gap in this PR.** The repo's `v3.7.0.md` is 382 lines; runtime is 484 lines. Runtime contains rules sections (Directive Compliance Gate, Scope Gate hard-block, Target Declaration, Fast-Path Classifier) that the repo lacks. **This is a separate reconciliation problem with its own PR and its own discussion.** Do not bundle it.

**CI guard to add (optional, but matches #105's pattern):** a check that no file inside `Releases/v4.0.3+/.claude/PAI/` (or wherever the canonical tree lives) contains a hardcoded `~/.claude/PAI` string.

**Verification:**
- `grep -rn '~/.claude/PAI' Releases/v4.0.3+/.claude/PAI/` should return zero results after the fix
- `RebuildPAI.ts` should not contain the literal string `.claude/PAI` in executable code; only env-var references

### #109 — Implementation plan

**Files to edit (all in repo, ASSUMING Path A is chosen):**

```
Packs/Learning/src/Workflows/Apply.md                                lines 68, 69, 70, 82
Releases/v4.0.3+/.claude/skills/Learning/Workflows/Apply.md          lines 68, 69, 70, 82
```

These two locations diverge by 4 bytes — determine which is the source-of-truth and how/whether they're kept in sync (might be a build step). The runtime version at `~/.pai/skills/Learning/Workflows/Apply.md` is 33-37 bytes ahead of both and is **explicitly out of scope** for this PR.

**Specific line edits:**

| Line | Current | Fixed (Path A) |
|---|---|---|
| 68 | `Read \`~/.claude/PAI/Algorithm/LATEST\`...` | `Read \`~/.pai/PAI/Algorithm/LATEST\`...` |
| 69 | `Read \`~/.claude/AISTEERINGRULES.md\`` (phantom file) | `Read \`~/.pai/PAI/AISTEERINGRULES.md\`` |
| 70 | `Read the PAI memory directory \`~/.claude/projects/*/memory/\`...` | `Read the Claude Code project memory directory \`~/.claude/projects/*/memory/\`...` |
| 82 | `...written to the PAI memory directory.` | `...written to the Claude Code project memory directory (per-cwd silo by design — see #109).` |

**If Path B is chosen instead**, lines 70 and 82 point at the new `~/.pai/MEMORY/FEEDBACK/` location, plus build the directory + loader + migration. Larger change.

**Audit Check.md and Review.md** in the same workflow directory for the same pattern. The original investigation only verified Apply.md.

**Verification:**
- `grep -n '~/.claude/AISTEERINGRULES.md' Packs/Learning/` should return zero results
- The phrase "PAI memory directory" should not appear in any Learning skill workflow file referring to a `~/.claude/projects/` path

### #110 — Deferred work plan

Not for tonight. When picked up:

1. Read #110 + #115 fully — they are coupled
2. Build an ownership manifest: enumerate each `~/.claude/skills/<dir>/` and classify as PAI-pack-owned (symlink target) vs third-party / user-installed (leave alone). On the investigation machine, `tts-tutor-skill` was identified as third-party (only existed in `~/.claude/skills/`, not in `~/.pai/skills/`)
3. Decide ordering relative to #115
4. Decide Option B (per-pack symlinks) vs Option B + Option D (symlinks now, upstream feature later)
5. Design installer changes that create symlinks on first install and idempotently convert pre-existing dirs on upgrade
6. (Optional) File upstream Claude Code feature request for `skillsPaths` settings.json field

### #115 — Deferred work plan

Not for tonight. When picked up:

1. Decide override mechanism: env var (`PAI_REPO_URL`), settings.json field (`pai.repoUrl` already exists in `config-gen.ts` — just plumb it through to `runRepository`), CLI flag, or auto-detect existing remote
2. Patch `engine/actions.ts:529` and `engine/actions.ts:539` to use the configured URL
3. Patch the existing-install path at `engine/actions.ts:511` to read the existing remote rather than assuming upstream
4. Document fork-mode install instructions
5. Coordinate with #110 — both touch the installer

---

## Runtime state on this machine (as of 2026-04-14 ~01:00 BST)

This is **machine-specific** and not relevant to anyone working from a fresh checkout — but matters for anyone trying to verify findings against the same machine:

| Path | State |
|---|---|
| `~/.claude/PAI/` | **Deleted** (manual cleanup, backup at `~/backups/pai/claude-20260414-004729/PAI/`) |
| `~/.claude/PAI-Install/` | **Deleted** (manual cleanup, backup at `~/backups/pai/claude-20260414-004729/PAI-Install/`) |
| `~/.claude/CLAUDE.md` | **In active user editing** — last seen mid-transition (Algorithm v3.7.0 → v3.5.0, Notify.ts → inline curl). Do not touch from a Claude conversation. |
| `~/.pai/PAI/AISTEERINGRULES.md` | **In active /Learn editing** — grew 6313 → 11926 b mid-investigation as /Learn appended new rules. Do not touch from a Claude conversation. |
| `~/.pai/PAI/Algorithm/v3.7.0.md` | 484 lines, 40197 b — 102 lines ahead of repo (Directive Compliance Gate, Scope Gate hard-block, etc.) |
| `~/.claude/skills/` | Untouched — 178 MB, 8392 files. Includes `tts-tutor-skill` which is third-party and only exists here, not in `~/.pai/skills/` |
| `~/.pai/skills/` | Untouched — 178 MB, 8391 files. Canonical-by-#101-design but never read by Claude Code harness |
| `~/.claude/.git/` | Does not exist — `~/.claude/` is not a git repo on this machine |
| `~/.pai/.git/` | Does not exist — `~/.pai/` is not a git repo on this machine |

**Implication:** The installer's `git pull origin main` code path at `engine/actions.ts:511` is unreachable on this machine (no `.git/`). The `git clone` path at line 529 would fail because `~/.claude/` is non-empty. The fallback init+fetch+checkout path at line 539 would attempt to overlay upstream files. None of these will run unless `install.sh` is explicitly invoked.

**Most importantly:** the installer never touches `~/.pai/`. All runtime PAI content under `~/.pai/` is **regression-safe** from any installer invocation. The runtime drift between `~/.claude/skills/` and `~/.pai/skills/` (e.g. `tts-tutor-skill`) is therefore not maintained by the installer's current code — it predates this code path and was created by some other mechanism (likely a one-shot manual hand-migration during PR #101 rollout).

---

## Branch + PR strategy

**Recommendation:** one branch per issue, two PRs.

```
git checkout -b fix/108-residual-claude-pai-paths
# implement #108 surgical fixes
# request user approval before commit + push + PR

git checkout main
git checkout -b fix/109-learning-skill-feedback-paths
# implement #109 fixes (after user picks Path A vs B)
# request user approval before commit + push + PR
```

Alternative: bundle as one PR. Simpler review but more entangled to revert. Decide with user before opening branches.

**Per MARR `prj-version-control-standard.md`:** explicit approval required for every `git commit`, `git push`, and `gh pr create`. Working-tree edits are fine without approval.

---

## Fresh-conversation handoff notes

If you are picking this up in a new conversation:

1. **Read this doc first.** It captures decisions and constraints not in the issue bodies.
2. **Then read the relevant issue and all its comments.** Pay attention to the most recent comments — they contain corrections and updates to the original issue body.
3. **Verify file state before editing.** File line numbers cited in this doc and in the issues were accurate as of 2026-04-14. They may have shifted. Re-verify with `grep -n` before applying any edit.
4. **Do not assume the runtime state.** This doc describes one specific machine's state. A fresh checkout will have a different state.
5. **Do not commit without explicit approval.** The user has been clear about this. Working-tree edits and reading are fine; staging + committing requires a go.
6. **Path A vs Path B (#109) is a USER decision.** Do not pick it autonomously. Surface it explicitly and wait for an answer.
7. **The 102-line Algorithm gap is a separate problem.** Do not bundle it with #108's residual-string fix.
8. **#110 and #115 are not in tonight's scope.** Refer to this doc's per-issue work plans for what they need before being picked up.

---

## Investigation artifacts (not needed for implementation, but useful for context)

- Issue #108: original body + update comment (with the 102-line gap finding, surgical-only decision, runtime-state notes, installer behavior summary)
- Issue #109: original body + update comment (with the Path A/B decision matrix and tonight's scope)
- Issue #110: original body + update comment (with installer behavior, #115 cross-ref, deferral rationale)
- Issue #115: filed today, contains full analysis of `engine/actions.ts:498-577` hardcoded URL behavior
- Backup at `~/backups/pai/claude-20260414-004729/` — full byte-verified copy of `~/.claude/PAI/` and `~/.claude/PAI-Install/` as they existed before deletion
