# Apply PR #154 to the Live Runtime — Cherry-Pick Plan

## Context

PR #154 (commit `1542ae9`) added a PAI-level user-choice Q&A contract and trigger gate. By design, **only the shipped artefact at `Releases/v4.0.3+/` was modified**; the live runtime at `~/.pai/` + `~/.claude/` was intentionally untouched (per the commit message). The user now wants to apply #154 to the live runtime *without* running a fresh install.

**Why this is non-trivial:**
- The runtime is **not a git checkout** — no `~/.pai/.git`, no `~/.claude/.git` → `git pull` is not an option.
- `~/.claude/CLAUDE.md.template` and `~/.pai/PAI/Tools/preserve-claudemd.ts` do not exist in the live runtime — `BuildCLAUDE.ts` returns inert (template-missing branch). The runtime is hand-edited markdown, not template-rebuilt.
- The runtime has **independent drift** on most affected files. Whole-file copy would wipe runtime-unique content.
- `~/.claude/CLAUDE.md` has user-injected `@-imports` (`@CLAUDE-USER.md`, `@marr/MARR-USER-CLAUDE.md`) at the top that are absent from `Releases/v4.0.3+/.claude/CLAUDE.md`. A whole-file copy here is destructive.

**Verified drift sample (`PAI/Algorithm/v3.7.0.md`, 40 diff lines):**
- Runtime-unique (must keep): line 7 — `(ALGORITHM, NATIVE, ITERATION, or MINIMAL)`. Releases knows only `(ALGORITHM or NATIVE)`.
- Releases-unique (want to import): #154's ENUMERATE→OFFER block (~26 lines, lines 292–305 in Releases).
- Releases-unique path corrections: `~/.claude/PAI/PRDFORMAT.md` → `~/.pai/PAI/PRDFORMAT.md` (multiple sites). These came from prior two-root cleanup PRs, not #154 itself.

**Outcome wanted:** every #154 delta is present in the live runtime; no runtime-unique content is destroyed.

## Approach: Per-file selective merge

Whole-file copy is rejected. Each of the 7 files in #154 gets distinct treatment.

### File-by-file map

| # | Source (Releases) | Target (runtime) | Strategy | Risk |
|---|-------------------|------------------|----------|------|
| 1 | `Releases/v4.0.3+/.claude/PAI/PROTOCOLS/qa-contract.md` | `~/.pai/PAI/PROTOCOLS/qa-contract.md` (NEW) | `mkdir -p ~/.pai/PAI/PROTOCOLS/` then `cp` | None — directory and file don't exist in runtime |
| 2 | `Releases/v4.0.3+/.claude/CLAUDE.md` (lines added by #154 only) | `~/.claude/CLAUDE.md` | Surgical insert: add `❓ OPEN_CHOICES:` field + rule paragraph; fix `completes.Critical Rules` line-merge typo. **Preserve user `@-imports` at top.** | Medium — must avoid touching user @-imports |
| 3 | `Releases/v4.0.3+/.claude/PAI/Algorithm/v3.7.0.md` | `~/.pai/PAI/Algorithm/v3.7.0.md` | Insert ENUMERATE→OFFER block at the OBSERVE-exit position. Keep runtime's ITERATION/MINIMAL line + leave path-correction question separate (see Open question below). | Medium — drift confirmed, three-way merge required |
| 4 | `Releases/v4.0.3+/.claude/PAI/AISTEERINGRULES.md` | `~/.pai/PAI/AISTEERINGRULES.md` | Three-way merge: 59 diff lines vs only 1 line added by #154 → most drift is unrelated. Diff and apply only the "AskUserQuestion for choices" rewrite. | High — large unrelated drift, must isolate the #154 hunk |
| 5 | `Releases/v4.0.3+/.claude/PAI/SKILLSYSTEM.md` | `~/.pai/PAI/SKILLSYSTEM.md` | Three-way merge: 69 diff lines vs only 2 lines added by #154 → ~67 lines of unrelated drift. Apply only the user-choice policy line + done-state addition. | High — large unrelated drift |
| 6 | `Releases/v4.0.3+/.claude/PAI/THEDELEGATIONSYSTEM.md` | `~/.pai/PAI/THEDELEGATIONSYSTEM.md` | Three-way merge: 40 diff lines, #154 added 35 → likely mostly the #154 block plus minor drift. Diff to confirm, then insert. | Medium |
| 7 | `Releases/v4.0.3+/.claude/CLAUDE.md.template` | (none) | **SKIP** — no template in runtime; injecting one would change runtime architecture (activate `BuildCLAUDE.ts` rebuild path). Out of scope for this cherry-pick. | N/A |

### Execution order (one file at a time, per "solo-serial large edit batches" memory)

1. **Snapshot.** Backup runtime before any edit:
   - `cp -r /Users/ianmarr/.pai /Users/ianmarr/.pai.bak-pre-154-$(date +%s)`
   - `cp /Users/ianmarr/.claude/CLAUDE.md /Users/ianmarr/.claude/CLAUDE.md.bak-pre-154-$(date +%s)`
2. **File 1 (zero-risk).** Create `~/.pai/PAI/PROTOCOLS/`, copy `qa-contract.md`. Verify: `ls -la` and `wc -l` matches Releases (194 lines).
3. **File 2 (CLAUDE.md surgical).** Three Edit calls into `~/.claude/CLAUDE.md`:
   - (a) Insert `❓ OPEN_CHOICES:` line into the NATIVE format block (after the `🗒️ TASK:` line area, matching the position in Releases).
   - (b) Insert the **OPEN_CHOICES rule** paragraph immediately after the NATIVE format fenced block.
   - (c) Fix the line-merge typo so `...completes.Critical Rules` becomes a clean `\n\n### Critical Rules (Zero Exceptions)\n` heading; restore the matching `(ALGORITHM or NATIVE)` → keep runtime's existing wording (do not regress).
   - User `@-imports` at the top must remain untouched.
4. **File 3 (Algorithm v3.7.0.md).** One Edit: insert the ENUMERATE→OFFER sub-step block at the documented position (after the assumption-verification gate, before THINK). Do not regress the runtime's ITERATION/MINIMAL mode line. Leave the `~/.claude/PAI/PRDFORMAT.md → ~/.pai/PAI/PRDFORMAT.md` path corrections out of this PR (raise as a separate issue — see Open question 2).
5. **File 6 (THEDELEGATIONSYSTEM.md).** Print full diff first; if clean (≤5 unrelated lines), apply the "User-choice bubbling" subsection insert.
6. **File 4 (AISTEERINGRULES.md).** Diff; isolate the single 1-line "AskUserQuestion for choices" hunk (1 changed line per #154 stat). Apply only that hunk.
7. **File 5 (SKILLSYSTEM.md).** Diff; isolate the 2-line policy + done-state additions. Apply only those.

After each file: grep for the #154 marker word in the target (`OPEN_CHOICES`, `qa-contract`, `ENUMERATE→OFFER`, `User-choice bubbling`, `pending_user_choices`) to confirm the apply landed.

### Critical files

**Sources** (all under `/Users/ianmarr/projects/pai/Releases/v4.0.3+/.claude/`):
- `CLAUDE.md`
- `PAI/AISTEERINGRULES.md`
- `PAI/Algorithm/v3.7.0.md`
- `PAI/PROTOCOLS/qa-contract.md`
- `PAI/SKILLSYSTEM.md`
- `PAI/THEDELEGATIONSYSTEM.md`

**Targets**:
- `/Users/ianmarr/.claude/CLAUDE.md`
- `/Users/ianmarr/.pai/PAI/AISTEERINGRULES.md`
- `/Users/ianmarr/.pai/PAI/Algorithm/v3.7.0.md`
- `/Users/ianmarr/.pai/PAI/PROTOCOLS/qa-contract.md` (new — directory must be created)
- `/Users/ianmarr/.pai/PAI/SKILLSYSTEM.md`
- `/Users/ianmarr/.pai/PAI/THEDELEGATIONSYSTEM.md`

**Reference for verification logic**: `/Users/ianmarr/.pai/PAI/Tools/BuildCLAUDE.ts` (informational only — confirms the runtime is template-less, not a rebuild target).

## Verification

After all files applied, in a **fresh Claude session** (so SessionStart hooks reload the docs):

1. **NATIVE format check.** Trigger a NATIVE-mode response and confirm output includes `❓ OPEN_CHOICES:` line. → confirms `~/.claude/CLAUDE.md` apply.
2. **Protocol file check.** `ls -la /Users/ianmarr/.pai/PAI/PROTOCOLS/qa-contract.md` and `wc -l` = 194. → confirms File 1.
3. **Algorithm gate check.** Trigger an Algorithm-mode multi-step task and confirm the OBSERVE-exit phase mentions ENUMERATE→OFFER (or the gate triggers an `AskUserQuestion`). → confirms File 3.
4. **Cross-reference check.** `grep -l "qa-contract" /Users/ianmarr/.pai/PAI/THEDELEGATIONSYSTEM.md /Users/ianmarr/.pai/PAI/Algorithm/v3.7.0.md` should return both files (THEDELEGATIONSYSTEM references qa-contract; Algorithm references both qa-contract and THEDELEGATIONSYSTEM). → confirms cross-doc integrity.
5. **Drift-preservation check.** `grep "ITERATION\|MINIMAL" /Users/ianmarr/.pai/PAI/Algorithm/v3.7.0.md` returns the runtime-unique line. → confirms drift was preserved, not destroyed.
6. **Backup integrity.** `~/.pai.bak-pre-154-*` and `~/.claude/CLAUDE.md.bak-pre-154-*` exist for rollback.

## Rollback

- **Per-file**: restore from the `*.bak-pre-154-*` snapshots.
- **Full**: `rm -rf ~/.pai && mv ~/.pai.bak-pre-154-* ~/.pai` (after confirming directory pairing).

## Open questions (not blocking the plan, but worth deciding before execution)

1. **Scope of CLAUDE.md.template.** The runtime has no template. Two viable futures: (a) keep status quo — runtime is hand-edited, no template; (b) install the template + activate `BuildCLAUDE.ts` rebuild path. (b) is a bigger architectural change and is **out of scope** for this cherry-pick. Recommendation: defer to a separate issue.
2. **Path corrections (`~/.claude/PAI/X` → `~/.pai/PAI/X`) inside `Algorithm/v3.7.0.md` and others.** These came from earlier two-root cleanup PRs (#129, #130, #133), not #154. They're orthogonal to #154 and would need their own runtime-apply pass. Recommendation: separate work item; this plan does not include them.
3. **Outstanding scope for runtime catch-up.** This plan ports #154 only. Older Releases-only PRs (#137, #138, #150, #149, #135, #136) may also have runtime gaps. Recommendation: separate audit, separate plan.

## Risk summary

- **Highest-risk files**: AISTEERINGRULES.md (59 lines drift, #154 added 1) and SKILLSYSTEM.md (69 lines drift, #154 added 2). Treat as high-attention serial edits.
- **Architectural risk**: cherry-picking like this normalises a "runtime forward-port" mechanism that PAI doesn't formally have. Worth documenting as a precedent (or rejecting it explicitly) so future drift handling is consistent.
- **Recoverability**: full snapshot before any edit + per-file `.bak` files → rollback is a single `mv`.
