# Issue #146 — Pack Command Staging Investigation

**Date:** 2026-04-27
**Branch:** `investigate/146-pack-command-staging`
**Scope:** Investigation only. Implementation deferred to a follow-up issue.

---

## TL;DR

`engine/command-migration.ts` works as designed but its design contract — *"packs stage their sources into `~/.pai/commands/` during their own install step"* — is satisfied by **no code in the installer**. There is no per-pack install hook concept; there is no populator. As a result, on this laptop and any like it, `migratePerPackCommands` is a no-op against an empty source.

**Recommended mechanism:** a hybrid of issue-options 1 and 2 — a per-pack populator (option 1's surface) that walks `Packs/*/src/commands/` on every install, with **per-file copy-if-not-exists** semantics (option 2's idempotency model, applied at file granularity).

**Implementation lands in `Releases/v4.0.3+/.claude/PAI-Install/engine/`** — the canonical shipped installer source. Not in any runtime install copy (`~/.claude/PAI-Install/engine/`) and not at any other location. See "Implementation location" below for why this matters.

This satisfies the three perspectives convened (installer maintainer, end user, future pack author) and resolves both gaps named in the issue without introducing the silent-overwrite or silent-skip-on-upgrade failure modes that all three perspectives independently flagged.

---

## Empirical state (verified 2026-04-27)

| Path | Status |
|---|---|
| `~/.pai/commands/` | Absent |
| `~/.claude/commands/context-search.md` | Present, mtime 19 Mar (placed by pre-#113 wizard) |
| `~/.claude/commands/cs.md` | Absent (despite being shipped in the pack) |
| `Packs/ContextSearch/src/commands/` | Contains `cs.md` and `context-search.md` |
| `Packs/<other 16 packs>/commands/` | None ship commands today |

So even after merge of #113 (commands canonicalisation) and #160 (SecurityValidator runtime materialiser), the runtime has no `~/.pai/commands/` at all on this machine.

---

## Code-precedent analysis

### `command-migration.ts` (#113)

Header (lines 18-29):

> If `~/.pai/commands/<name>.md` exists as a real file → PAI-owned. If `~/.pai/commands/` is empty (fresh install, right after git clone) → **the caller has not yet placed pack-source commands, so nothing to do. Packs stage their sources into `~/.pai/commands/` during their own install step;** this migrator only converts the `~/.claude/commands/` side into symlinks.

Implementation (lines 113-121, 235): `paiOwnedSet` is computed as the set of real `.md` files in `~/.pai/commands/`. Anything not in that set is `"third-party"` and skipped. Empty `~/.pai/commands/` → empty set → every name is third-party → no-op.

The issue's paraphrase of the ownership rule is faithful to source.

### `skill-migration.ts` (#110) — the asymmetric analogue

Lines 256-259:

```ts
let paiOwnedSet = collectOwnedDirs(paiSkillsDir);
if (paiOwnedSet.size === 0) {
  paiOwnedSet = collectOwnedDirs(claudeSkillsDir);
}
```

Skills handle the empty-pai-side case by trusting the claude side as ownership truth on first run. The header comment justifies this: *"every top-level dir in `~/.claude/skills/` is PAI-owned. Nothing third-party could exist at that moment."*

Commands have **no equivalent fallback**. This is the asymmetry the issue surfaces.

A naive "port the fallback to commands" would not actually fix the bug, however: skills' fallback works because the pre-#110 install wizard had populated `~/.claude/skills/<pack>/`. For commands, on this laptop, `~/.claude/commands/` is also nearly-empty (one stale file). A claude-side fallback there would still miss `cs.md`.

### `pai-runtime-migration.ts` (#160) — SecurityValidator precedent

This is the recent precedent for materialising shipped artefacts into `~/.pai/`. Two relevant patterns:

1. **Skip-if-identical** (line 137 `filesIdentical`): byte-compares src against dst before writing; if identical, no copy.
2. **Filename divergence for user-edit preservation** (lines 264-269 `cpSync` of `PAISECURITYSYSTEM/`): cpSync walks only the source tree, so dest-only files like the user's `patterns.yaml` are never visited. The shipped `patterns.example.yaml` and the user's `patterns.yaml` have **different filenames** by design.

For commands, this precedent transfers only partially. Commands don't have the `*.example.md` / `*.md` filename divergence; the shipped artefact and the user-editable artefact share a name. Skip-if-identical alone would still overwrite a user-edited `cs.md` (because the bytes differ). The right transfer of this precedent is at the **policy** level (preserve user edits), not the **implementation** level (byte-compare).

### `actions.ts:497-622` — install flow

`runRepository` calls migrators in this order:

```
migrateMemoryDirectory  →  migratePerPackSymlinks  →  migratePerPackCommands  →  migratePaiRuntime
```

There is **no per-pack install hook concept** anywhere in this flow. Packs are pure directory inventory; the installer never iterates `Packs/*/`. (Confirmed by an independent installer-wide scan.)

This kills issue-mechanism 1 in its naive form: there is no "per-pack installer" that could be wired up. What can exist instead is a **single populator step** that walks `Packs/*/src/commands/` and stages files — invoked just before `migratePerPackCommands`.

---

## Mechanism evaluation

### Mechanism 1 — populator walks `Packs/*/src/commands/` every install

**Code reuse:** Reuses `getPaiCommandsDir()`. New code is one walker.
**Idempotency:** Depends on copy semantics (see below).
**Third-party preservation:** Preserved — only files with a `Packs/<Pack>/src/commands/<name>.md` source get staged.
**Failure surfaced by council:** if implemented as unconditional copy, **silently overwrites user edits** on every install. End-user perspective ranked this last for that reason.

### Mechanism 2 — fallback inside `command-migration.ts` (mirror skill-migration)

**Code reuse:** Single function change in `command-migration.ts`.
**Idempotency:** Already idempotent.
**Third-party preservation:** Preserved.
**Failure surfaced by council:** "first-install only" trigger means a pack that ships a new command in v4.0.5 never lands on a v4.0.4 install that already has `~/.pai/commands/` populated. Silent regression on upgrade.

### Mechanism 3 — on-demand `pai sync-commands` tool

**Trigger problem:** user must know to run it. Universally ranked last by all three perspectives. Useful as a complement, not as primary mechanism.

### Mechanism 4 — other

Independently scanned the installer (`Releases/v4.0.3+/.claude/PAI-Install/`) for any 5th materialisation shape. **None found.** Pack-shipped artefacts can only enter the runtime via the four mechanisms in `actions.ts:runRepository` (memory, skills, commands, pai-runtime).

No pack manifest format exists (no `pack.json` / `pack.yaml` discovery anywhere). Adding one is a larger architectural decision and not warranted for the commands-only problem today.

---

## Council synthesis

| Perspective | 1st | 2nd | 3rd | Reason for last place |
|---|---|---|---|---|
| Installer Maintainer | 2 | 1 | 3 | "Wrong layer for `runRepository`" |
| End User | 2 | 3 | 1 | "Silent overwrite on routine upgrade" |
| Future Pack Author | 1 | 2 | 3 | "Manual sync step users will skip" |

Universal: option 3 last.

Convergent failure mode (named independently by all three): coarse trigger semantics. Both mechanism 1 (in its naive form) and mechanism 2 fail in different ways at the same boundary — mechanism 1 by overwriting, mechanism 2 by silently skipping new pack commands on upgrades.

**The synthesis collapses 1 and 2 into a hybrid:** mechanism 1's surface and discovery contract (walk `Packs/*/src/commands/` on every install) with **per-file copy-if-not-exists** semantics (mechanism 2's idempotency model applied at file granularity instead of directory granularity).

---

## Recommendation

**Adopt the hybrid: a per-pack populator step in `runRepository`, run BEFORE `migratePerPackCommands`, with `cp -n` (per-file copy-if-not-exists) semantics.**

### How this resolves the gaps

**GAP 1 — canonical staging.** Populator walks `Packs/*/src/commands/<name>.md`. For each file, if `~/.pai/commands/<name>.md` does not exist, copy it. This populates `~/.pai/commands/` from the canonical pack source on every install, including upgrades that ship new commands.

**GAP 2 — orphaned runtime files.** Once the populator stages `~/.pai/commands/context-search.md` from the pack source, the existing `command-migration.ts` classifier sees:
- Old `~/.claude/commands/context-search.md` (real file, placed by pre-#113 wizard)
- New `~/.pai/commands/context-search.md` (real file, just staged)
- Classification: `drift-both-sides`
- Action: back up `~/.pai/` side to `<name>.backup-<ts>`, move claude side over, symlink.

This is the existing `command-migration.ts` drift-resolution path doing its job. The orphan's contents are preserved in the backup; the canonical pack source becomes the active runtime file. Not perfect (the user's stale `~/.claude/commands/context-search.md` may have edits the user wanted to keep, but those go to the backup file), but reversible and auditable.

For `cs.md` (which was never placed by any wizard), the populator stages it; `command-migration.ts` sees `pai-only-pai-side` and creates the symlink. Clean path.

### User-edit preservation

`cp -n` semantics: if `~/.pai/commands/<name>.md` already exists (regardless of whether it differs from the pack source), the populator skips it. User edits to `cs.md` survive every reinstall.

Consequence: pack updates to a command DO NOT propagate to users who have any version of that file in `~/.pai/commands/`. This is the deliberate trade — predictable preservation over silent freshness. Users who want pack updates can `rm ~/.pai/commands/<name>.md && pai install`.

### Single-rule symmetry with skills (Pack Author satisfaction)

The contract becomes: *"To ship X with your pack, place it under `Packs/<Pack>/src/<X>/`. The installer's per-pack-source step copies it into `~/.pai/<X>/` if not already present."* This generalises beyond commands; #145 (Research/Learning resync) is the same shape applied to skills, and a generalised populator could subsume both.

### Risks the recommendation does NOT address

1. **Pack updates to a command never reach users who have that command.** `cp -n` is intentional; the cost is staleness. Possible future mitigation: hash the canonical version at copy time, store a sidecar marker, only skip if user has edited; but this is mechanism creep and not warranted today.
2. **Two packs shipping the same command name** would resolve to first-pack-wins (alphabetical iteration). Not a problem today (only ContextSearch ships commands) but worth noting in the implementation issue.
3. **Conflicts with #144's two-root restructure.** If #144 lands, this populator step may need to live elsewhere. Recommendation should be re-evaluated after #144 is decided.
4. **Claude Code harness scan path.** `~/.claude/commands/` symlinks remain the read path; this recommendation does not change that. If Claude Code adds `~/.pai/commands/` discovery natively, the entire migration architecture (#113) becomes unnecessary, including this populator.

---

## Implementation location

PAI has three candidate `engine/` paths, and a future implementer must not pick the wrong one:

| Path | Role | Implementation goes here? |
|---|---|---|
| `Releases/v4.0.3+/.claude/PAI-Install/engine/` | Shipped installer source. What `git pull` ships and what the installer copies *from*. | **Yes — this is the only correct location.** |
| `~/.claude/PAI-Install/engine/` | Live runtime install copy of the above. Absent on a laptop that hasn't been installed. | No. Edits here would be runtime-local and not reach other users. |
| (no `engine/` at repo root) | — | No such directory exists. |

The recent SecurityValidator regression chain (#156→#157→#158→#159→#160→#161→#162→#163) re-learned this the hard way: hook fixes that didn't propagate into the Releases tree don't reach users on next install. **Same constraint applies here: the populator MUST live in the Releases tree to ship.**

Memory `feedback_aisteeringrules_learn_authority.md` describes the related "runtime canonical, Releases lags, backport (runtime → Releases) is the right cleanup pattern" — that pattern applies to AISTEERINGRULES.md *behavioural* rules. For installer *code*, the direction is reversed: **Releases is canonical and the runtime copy is downstream of it**. Edits go to Releases first.

## Suggested follow-up issue

Title: *Add per-pack populator step to stage `Packs/<Pack>/src/commands/` into `~/.pai/commands/` (closes #146)*

Acceptance:
- New file at `Releases/v4.0.3+/.claude/PAI-Install/engine/pack-source-staging.ts` (or extension of an existing module in that same directory) walks `Packs/*/src/commands/<name>.md`, copies each into `~/.pai/commands/<name>.md` only if dest does not exist.
- `Releases/v4.0.3+/.claude/PAI-Install/engine/actions.ts:runRepository` invokes the new step BEFORE `migratePerPackCommands`.
- Soft-fail per file (matches existing migrator pattern).
- Idempotent: second run on an unchanged install does no writes.
- Test fixture covers: fresh install (populator creates files); upgrade with user-edits (populator skips); upgrade shipping new command (populator stages new file).

Out of scope for that follow-up: skill-side analogue (#145), generalised pack-source-walker (decide after the commands case is in hand), promotion to a newer Releases version directory if v4.0.4 is cut in the meantime (rebase onto whatever Releases path is current at implementation time).

---

## Verification trail

| Claim | Evidence |
|---|---|
| `~/.pai/commands/` absent | `ls ~/.pai/commands/ → No such file or directory` (2026-04-27) |
| Only ContextSearch ships commands | `find Packs -type d -name commands` returns one path |
| `command-migration.ts` ownership rule | Source lines 113-121 in `Releases/v4.0.3+/.claude/PAI-Install/engine/command-migration.ts` |
| `skill-migration.ts` has fallback | Source lines 256-259, same engine dir |
| No per-pack hook | Independent scan of `Releases/v4.0.3+/.claude/PAI-Install/` (Explore agent, 2026-04-27) confirmed only the four migrators iterate runtime targets |
| SecurityValidator user-edit pattern | `pai-runtime-migration.ts:264-269` (cpSync of source-only tree) |
