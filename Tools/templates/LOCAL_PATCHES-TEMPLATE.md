# Local Patches to PAI SYSTEM Files

Tracks modifications to SYSTEM-tier files that would be overwritten by a PAI update.
**Check this file before and after any `git pull` + reinstall.**

---

## How to Use

1. **Before PAI update:** Run the upgrade check tool first:
   ```
   bun Tools/UpgradeCheck.ts <target-version>
   ```
   This diffs all active patches against the target release, checks linked issues, and produces a structured report (SAFE/CONFLICT/RETIRE per patch). Use its output to plan the merge.
2. **After PAI update:** Run the Reconciliation Procedure below
3. **After any settings.json change:** CLAUDE.md auto-rebuilds on next session start via BuildCLAUDE.ts. Manual: `bun ~/.claude/PAI/Tools/BuildCLAUDE.ts`

## Reconciliation Procedure (run after every PAI upgrade)

### Step 1 — Issue Status Check

For each ACTIVE patch with a linked issue, check upstream status:
```
gh issue view {number} --repo danielmiessler/Personal_AI_Infrastructure --json state,closedAt
```
- If **OPEN** -> patch still needed. Re-apply after upgrade.
- If **CLOSED** -> proceed to Step 2 for that patch.
- If **no issue linked** -> proceed directly to Step 3.

### Step 2 — Semantic Diff (for closed issues)

For each patch whose issue is now closed:
1. Read the upstream's new version of the patched file
2. Check: does the new version address the same problem our patch addressed?
3. Classify the outcome:

| Outcome | Signal | Action |
|---|---|---|
| **Exact fix** | Upstream change matches our patch intent, problem is gone | Mark RETIRED. Remove local patch. |
| **Different fix** | Upstream addressed the issue differently | Test upstream's version. If it works -> mark SUPERSEDED. If not -> keep patch, comment on issue. |
| **Closed but not fixed** | Issue closed in a sweep, "won't fix", or fix is in unreleased branch | Keep patch. Re-open or comment on issue. |

### Step 3 — File-Level Diff (catches unlinked upstream fixes)

Even with issue linking, upstream might fix something without referencing our issue:
```
# For each active patch, diff the incoming file against our patched version
diff ~/.claude/{patched-file} ~/PAI/Releases/vX.Y/.claude/{patched-file}
```
- Any SYSTEM file that **changed upstream AND has an active patch** -> manual review
- This catches the scenario where upstream fixes our problem without closing our issue

---

## Retired Patches (merged upstream or superseded)

### ~~1. Example: statusline-command.sh - Missing token count~~ — UPSTREAM in v3.0

**Issue:** [#NNN](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/NNN) — **CLOSED 2026-XX-XX**.
**Status:** RETIRED (exact fix — upstream matched our patch intent)

---

## Active Patches

### 1. Example: hook-file.ts - Description of what you fixed

**File:** `hooks/hook-file.ts`
**Issue:** [#NNN](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/NNN) (OPEN)
**Status:** ACTIVE
**Applied:** 2026-XX-XX
**Last checked:** 2026-XX-XX

**Problem:** Description of the upstream bug or missing feature.

**Our fix:** What you changed and why. Include enough detail that you can re-apply the patch after an upgrade.

---

## Custom Hooks (not patches — your additions)

| Hook | Purpose | Registered |
|------|---------|------------|
| `YourHook.hook.ts` | Description | Yes |

---

## Safe Files (not affected by updates)

| File | Why Safe |
|------|----------|
| `settings.json` | Personal config, must merge manually |
| `MEMORY/` | User data, never in upstream |
| `PAI/USER/` | USER tier, protected by design |
| `LOCAL_PATCHES.md` | This file |

---

## Generated Files (rebuild after update)

| File | Rebuild Command |
|------|----------------|
| `CLAUDE.md` | `bun ~/.claude/PAI/Tools/BuildCLAUDE.ts` |
