# v5 Adoption — Context & Principles

**Purpose:** Load this at the start of any session that touches v5-adoption work. It exists to prevent a specific, repeatable failure: reasoning about or editing the *wrong tree*. The working directory is the marrair fork (the thing being retired); the adoption target is a different repo and a different host. Get the tree right before doing anything.

---

## The goal (one sentence)

Migrate from the **marrair fork** (a heavily-customised v4.0.3+ PAI) onto **marrmini's vanilla v5.0.0** plus a deliberately-thin **overlay**, then decommission marrair. Each fork customisation is a *port candidate* that must justify itself against vanilla v5 before it earns a place in the overlay.

---

## The tree map (READ THIS FIRST, every time)

| Tree | Path / location | What it is | Invest? |
|---|---|---|---|
| **marrair fork — repo** | `virtualian/pai` (this working dir, `~/projects/pai`) | The old fork's source. `Releases/` stops at `v4.0.3+`. **This is the repo you are usually sitting in.** | ❌ Decommissioning. Do NOT make it better. Planning docs + reports about the migration live here, but fork *code* gets no new investment. |
| **marrair fork — runtime** | `~/.pai/` (and the `~/.claude/` of *this* session) | The old fork's live, **unversioned** runtime. | ❌ Decommissioning. Never edit directly for port work. |
| **v5 overlay — source** | `virtualian/pai-v5` repo → `Releases/v5.0.0-overlay/` on branch `bootstrap/v5-overlay-and-tooling` | The thin set of files layered onto vanilla v5.0.0. **This is where ports land.** | ✅ This is the target. Edit here (via per-issue branches cut from the bootstrap branch). |
| **destination host** | **marrmini**, vanilla v5.0.0 + overlay deployed to its `~/.claude/` | The machine that becomes primary after decommission. Reachable by SSH from marrair. | ✅ Verify against *this* — its deployed state is ground truth for "does v5 already do it?". |
| **vanilla v5.0.0 baseline** | `~/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/.claude/` | Frozen snapshot of clean v5.0.0 (pre-overlay). | Reference only — for "what does pristine v5 ship?". Prefer the live deployed marrmini state when it matters. |

**The trap:** the repo you're sitting in (`virtualian/pai`) and the runtime of your session (`~/.pai/`) are BOTH the fork being retired. Your ambient context points at the wrong tree. You must consciously redirect to `pai-v5` + marrmini for any port decision or edit.

---

## Core principles

1. **Minimise changes to v5.0.0.** The overlay is a maintenance liability — every file in it is drift to monitor on each upstream upgrade. A port must buy more than it costs. The overlay should stay thin.

2. **Verify-first, against the *deployed target*.** Before porting anything, confirm vanilla v5 doesn't already do it — and check the **live deployed marrmini state**, not the marrair fork and not only a baseline snapshot. "The fork lacks X" is irrelevant; the fork is being retired. The only question is whether *marrmini* lacks X.

3. **Default = drop.** If v5's behaviour is acceptable as-is — even imperfect — drop the port. Opt back in only at explicit choice moments. The workflow defaults to "drop everything; re-add only on deliberate decision."

4. **Choice-timing — re-confirm at three checkpoints.** (a) At categorisation, present apply/defer/drop rather than auto-slotting. (b) At issue-pickup, re-confirm the candidate is still wanted and the gap still exists. (c) At deploy-time, the per-feature branch composition is the final accept-or-skip.

5. **"Runtime is canonical" has a narrow scope.** That rule applies *only* to `AISTEERINGRULES.md` being auto-extended by `/learn` (forward drift by design; backport runtime→Releases at release cuts). It does **not** generalise to TS hook code, settings, or anything else. For code, the Releases/overlay source is canonical and deploys *to* runtime, not the reverse.

---

## Anti-patterns (these have actually happened — do not repeat)

- **Editing `~/.pai/` runtime for a port.** It's the decommissioning fork's unversioned runtime. Edits leave no audit trail and improve a system being thrown away.
- **Reasoning about `Releases/v4.0.3+/` to make a port decision.** That's the fork's release source — wrong tree. Port decisions are about what vanilla v5 / marrmini has and what the overlay should add.
- **Defaulting to the repo/runtime you're sitting in.** See "The trap" above. Always redirect to `pai-v5` + marrmini.
- **Generalising "runtime is canonical" beyond `/learn`-extended AISTEERINGRULES.md.** It misroutes code edits to the runtime.
- **Verifying against a baseline snapshot when the deployed state is reachable.** The overlay may have changed what's live on marrmini. SSH and check the real thing.
- **Treating "unversioned" as "safe to edit freely."** Unversioned means *no audit trail if you edit* — it's a stop-and-confirm signal about edit target, not a green light.

---

## Before you act: the which-tree checklist

Run this mentally before any read-for-decision or any edit:

1. **What tree does this task belong to?** Port decision or overlay edit → `pai-v5` + marrmini. Migration planning/reporting → `virtualian/pai` `Plans/`/`reports/`. Never the fork's code trees.
2. **If editing: is the target version-controlled, and is it the canonical source?** Overlay files live in `pai-v5`. Runtime is a deploy target, not an edit target.
3. **If deciding "does v5 already do it?": have I checked the deployed marrmini state**, not just a snapshot or the fork?
4. **Does the migration principle say drop?** Default yes unless a verified gap + a justification clears both bars.

---

## How to verify the v5 target state

- **Deployed marrmini state (ground truth):** `ssh marrmini "..."` — e.g. inspect `~/.claude/hooks/...`, `~/.claude/PAI/...`, `cat ~/.claude/PAI/Algorithm/LATEST`. The `claude` binary there may not be on the non-interactive PATH; use `/Users/ianmarr/.local/bin/claude` if `claude` is not found.
- **Overlay source tree:** `gh api "/repos/virtualian/pai-v5/git/trees/bootstrap/v5-overlay-and-tooling?recursive=1" --jq '.tree[] | select(.path | startswith("Releases/v5.0.0-overlay")) | .path'`
- **Vanilla baseline (pristine reference):** read under `~/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/.claude/`.
- **Confirm a candidate is genuinely absent on the target before porting** — the strongest evidence is "marrmini's deployed state lacks it", not "the fork has its own version" or "the baseline snapshot lacks it".

---

## Workflow

- **Port candidates** are tracked as issues on `virtualian/pai-v5`. Each port is a per-issue branch cut from `bootstrap/v5-overlay-and-tooling`; the overlay file(s) land there.
- **Deployment** to marrmini is via `deploy-overlay.sh` (rsync Class-A files + `jq`-merge Class-B `settings.json` overlay).
- **Tracking/decision records** (design-doc refreshes, wiring decisions, closure notes) are issues + PRs on `virtualian/pai` — these document the migration from the fork side.
- **Verify-first lives inside the port issue** as Step 0; default disposition is drop unless Step 0 confirms a real gap on the target.

---

## Canonical references

- **Design doc / plan of record:** [`Plans/v5-0-0-plus-port.md`](v5-0-0-plus-port.md) — priorities (HIGH/MED/LOW), migration principle, choice-timing principle, phase posture, decommission criteria.
- **Parent plan:** [`Plans/v5-0-0-is-a-major-keen-wall.md`](v5-0-0-is-a-major-keen-wall.md).
- **Migration umbrella issue:** `virtualian/pai#166`.
- **Overlay audit:** `reports/v5-comparison/v5-overlay-audit.md`.
- **Worked example of a clean verify-first → drop:** `reports/v5-comparison/pai-v5-11-scope-gate-gap.md` (HIGH#3 SCOPE GATE, closed won't-do after source-read + live-probe).

---

## Phase posture (as of 2026-05-20)

Mid-Phase B. HIGH bucket fully closed: pai-v5#1 MERGED (AskUserQuestion gate), pai-v5#2 MERGED (AISTEERINGRULES + `@imports`), pai-v5#11 won't-do (SCOPE GATE — v5 covers it). marrair remains primary; marrmini decommission criteria (≥1-week daily-use validation ×2, Class C transfer, REPL equivalence, ≥7 daily sessions) outstanding. Remaining port candidates are MED tier ("useful but not daily-blocking") — expect aggressive drops under the migration principle.
