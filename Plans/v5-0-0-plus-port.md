# Plan: v5.0.0+ Port — From marrair Fork Architecture Onto marrmini's Vanilla v5.0.0

## Context

This design doc is the Step 11 deliverable of issue #166
([`Plans/v5-0-0-is-a-major-keen-wall.md`](v5-0-0-is-a-major-keen-wall.md)).
#166's snapshot work captured:

- `~/backups/pai/runtime-marrair-20260508-002618/` — live fork runtime
  (62 fork commits + accreted state) on marrair
- `~/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/` — vanilla v5.0.0
  baseline produced by upstream's official installer on marrmini

This doc decides what gets ported forward, in what order, and where the
ports physically live.

**Output is design only. No code is ported in this PR.** Actual port work
happens in the follow-up issues sequenced below, against the new personal
fork `virtualian/pai-v5`.

## Decisions Locked

| Question | Decision |
| --- | --- |
| Personal fork name | **`virtualian/pai-v5`** (linked fork of `danielmiessler/Personal_AI_Infrastructure`) |
| Marrmini canonical clone | **`marrmini:~/projects/pai-v5/`** (single clone; old `~/projects/pai/` archived to `~/projects/pai-archive-pre-v5/`) |
| Overlay tree home | **`virtualian/pai-v5:Releases/v5.0.0-overlay/`** (in the new fork, not in `virtualian/pai`) |
| Deploy / check tooling home | **`virtualian/pai-v5:Tools/{deploy,check}-overlay.sh`** |
| Design doc home | **`virtualian/pai:Plans/v5-0-0-plus-port.md`** (this file; lives where #166's plan lives) |
| Algorithm baseline | **Adopt v5's v6.3.0 wholesale**; fork's v3.7.0 is superseded except for the AskUserQuestion ENUMERATE→OFFER gate which gets added on top via overlay |
| Two-root architecture (`~/.pai/` separated from `~/.claude/`) | **Not implementing.** marrmini stays single-root under `~/.claude/`. HIGH#3 dropped from priority list; issue #3 on virtualian/pai-v5 closed as won't-do; 7 migration helper files removed from overlay |
| Deploy-time selection mechanism | **Branch-as-feature** (per-issue branches on virtualian/pai-v5 each carry only that issue's overlay files; `deploy-overlay.sh` applies whatever's on the checked-out branch). `bootstrap/v5-overlay-and-tooling` is the scaffold/archive branch — NOT a deploy branch; cherry-pick into per-issue branches before deploying |
| Migration principle | **Minimise changes to v5.0.0.** Every port must (1) pass a verify-against-v5 check first (does v5 already do it?) and (2) justify the upgrade-drift cost it creates. Default to NOT porting unless both bars clear |
| Choice timing | **Local fixes/features chosen as early as possible.** Each candidate gets an accept/defer/drop decision at the EARLIEST plausible point in the workflow (categorisation, not after issue+overlay scaffolding). Repeated checkpoint at issue-pickup ("still wanted?") and at deploy-time ("deploy or skip?"). Avoids carrying dead candidates through the pipeline |
| Overlay structure | Mirrors `~/.claude/` path layout literally; rsync deploys via `--checksum` for idempotency |
| settings.json semantics | Class B per-key JSON-merge via `jq`; metadata keys (`_overlay_doc`, `_why`) stripped before merge; arrays REPLACE for now (TODO documented) |
| Class C personalisation | NEVER in overlay; one-time copy at Phase C cutover |
| First 3 issues | One issue per HIGH-priority port (one-issue-at-a-time per stored preference) |
| Wiring strategy for v6.3.0+local | **Option 3 — bump `LATEST` to `6.3.0+local`** + ship thin `v6.3.0+local.md` wrapper that loads v5's `v6.3.0.md` then applies `*-gate.md` addenda. v5's `v6.3.0.md` stays unmodified. Load chain: `CLAUDE.md` → `LATEST` → `v6.3.0+local.md` → (Read `v6.3.0.md` + `askuq-gate.md`). Establishes the **`vX.Y.Z+local` LATEST convention** for future fork-side Algorithm doctrine variants (Scope gate per HIGH#3 reuses this pattern). Rejected alternatives: (1) Class A overlay of `v6.3.0.md` — overwrites v5, high upgrade-drift; (2) `CLAUDE.md` section-append — needs `deploy-overlay.sh` CLAUDE.md-merge support, out of pai-v5#1 scope. Decision captured #173 (2026-05-11) |

## Source authority

The fork has **two physical sources** for the same conceptual content. They
diverge because marrair's workflow has been edit-commit-without-immediately-
reinstalling, so `Releases/v4.0.3+/` accreted intentional code that
`install.sh` was supposed to deploy to runtime but never did.

| Source | What it captures | Notes |
|---|---|---|
| `marrair:~/projects/pai/Releases/v4.0.3+/.claude/...` | **committed** tree, frozen as of `v4.0.3+-final` tag (commit `c7492b6`, 2026-05-08) | 12 files exist HERE that are absent from runtime; ~30+ files DIFFER from runtime |
| `marrair:~/.pai/...` and `marrair:~/.claude/...` | **live runtime** at snapshot time (2026-05-08T00:26:18) | Captures `/learn`-extended files (`AISTEERINGRULES.md`), AI-written `MEMORY/**`, user-edited identity files |

The plan's Phase 1 reversal ("runtime is source of truth") was correct
when assuming runtime is a SUPERSET of the committed tree (i.e., committed
+ accreted updates). It breaks when runtime is a SUBSET (committed +
forgotten installs). Both directions occur in practice, so the migration
needs a per-subtree authority rule.

### Authority rule (with empirically validated exceptions)

| Subtree | Authority | Rationale | Validated by |
|---|---|---|---|
| `PAI-Install/engine/*.ts` | v4 committed | Code, intentional, static | spot-check on engine files; v4-only set has 9 files |
| `hooks/*.hook.ts` and `hooks/lib/*.ts` | v4 committed | Code, intentional, static | `LoadContext.hook.ts`: v4 committer-date 2026-04-14, runtime mtime 2026-04-07 (rule holds) |
| `PAI/Tools/*.ts` | v4 committed | Code, intentional, static | v4-only: 3 files (WorkArchival.ts, preserve-claudemd{,.test}.ts) |
| `PAI/AISTEERINGRULES.md` (system) | runtime | Auto-extended by `/learn` | v4: 52 lines; runtime: 95 lines (clear extension) |
| `PAI/USER/AISTEERINGRULES.md` | runtime | Auto-extended by `/learn` (Class C anyway) | by definition |
| `PAI/Algorithm/*.md` | **runtime** ⚠️ rule exception | v3.7.0.md: v4 committer-date 2026-04-24, runtime mtime 2026-04-26 — runtime is NEWER. Likely auto-extended by AlgorithmUpgrade workflow | spot-check counter-example |
| `MEMORY/**` | runtime | AI-written; Class C | by definition |
| `PAI/USER/PRINCIPAL_IDENTITY.md`, `DA_IDENTITY.md`, etc. | runtime | Auto-updated by `/interview`; Class C | by definition |

### Audit results (this session)

- **12 v4-only files** added to overlay this session (see Overlay path
  strategy below; mostly two-root infrastructure for HIGH#3 + Tools/
  for MED-priority items)
- **~30 differing files** flagged but NOT bulk-pulled this session;
  per-file review happens when the relevant HIGH/MED issue is picked
  up. The deterministic rule's Algorithm-files counter-example warned
  us off blanket-applying it.

## Overlay path strategy

The overlay tree lives at `virtualian/pai-v5:Releases/v5.0.0-overlay/`. It
mirrors `~/.claude/`'s path layout exactly so `rsync` produces a clean
copy:

```
Releases/v5.0.0-overlay/
├── README.md
├── PAI/
│   ├── AISTEERINGRULES.md                       # Class A — replace (runtime authority)
│   ├── ALGORITHM/
│   │   └── askuq-gate.md                        # Class A — addendum (synthesised)
│   ├── PAI-Install/
│   │   └── engine/
│   │       ├── pai-paths.ts                     # Class A — v4-only, two-root foundation
│   │       ├── pai-runtime-migration.ts         # Class A — v4-only, two-root migrator
│   │       ├── memory-migration.ts (+test)      # Class A — v4-only
│   │       ├── skill-migration.ts (+test)       # Class A — v4-only
│   │       ├── command-migration.ts             # Class A — v4-only
│   │       ├── exec.ts                          # Class A — v4-only, tryExec helper
│   │       └── repo-url.ts                      # Class A — v4-only
│   └── TOOLS/
│       ├── WorkArchival.ts                      # Class A — v4-only
│       └── preserve-claudemd.ts (+test)         # Class A — v4-only
└── settings.json.overlay                        # Class B — JSON-merge with live
```

The 12 v4-only files (PAI-Install/engine/* + PAI/TOOLS/*) were added
**after** the initial scaffold this session, in response to the
"committed-but-not-deployed" finding. They mostly support HIGH#3
(two-root architecture) — the `pai-paths.ts` shared resolver in
particular was assumed to be new work in issue #3's first draft but
already exists in v4.0.3+.

`Tools/deploy-overlay.sh` does the rsync (Class A) + jq merge (Class B).
`Tools/check-overlay.sh` diffs overlay vs live `~/.claude/` and suggests
drop / keep / merge per file.

**Three deploy classes** (plus runtime state, excluded entirely):

| Class | Examples | Strategy |
|---|---|---|
| A. Pure overlay | SKILL.md trims, ported hooks, modified Algorithm/*.md, tools we wrote | Replace via rsync |
| B. Merge-semantics | `settings.json` (CC adds keys; user adds permissions), `CLAUDE.md` | Per-file merge logic in `deploy-overlay.sh` |
| C. Self-updating | `AISTEERINGRULES.md` (auto-extended by `/learn`), `MEMORY/**`, `USER/PRINCIPAL_IDENTITY.md`, `USER/DA_IDENTITY.md` | NEVER in overlay; one-time copy at Phase C |
| D. Runtime state | `history.jsonl`, `sessions/`, `cache/`, `.credentials.json` | Never tracked |

**Why Class C is excluded**: PAI self-updates these files. If they lived
in overlay, every `deploy-overlay.sh` run would stomp accumulated
state.

**Note on AISTEERINGRULES.md**: there are two of them. The **system file**
at `~/.claude/PAI/AISTEERINGRULES.md` is **Class A** (in overlay; the fork
ships behavioural rules absent from v5). The **user-overrides file** at
`~/.claude/PAI/USER/AISTEERINGRULES.md` is **Class C** (auto-extended by
`/learn`; never overlay). Same name, different files, different classes.

## Port Priority List

### Migration principle (sticky, applies to all priorities)

**Minimise changes to v5.0.0.** Each port must clear two bars before it
lands in the overlay:

1. **Verify v5 doesn't already do it.** Empirically (run a v5 session
   that exercises the behaviour) or read v5's source. If v5's behaviour
   is acceptable as-is — even imperfect — drop the port.
2. **Justify the change against the friction it creates.** Each overlay
   file is a maintenance liability (drift to monitor on every upstream
   upgrade, divergence from upstream's mental model). The port has to
   buy more than it costs.

Failure mode this principle prevents: porting fork-tradition items that
v5 already covers under a different name, or that don't matter enough
to be worth the upgrade-friction cost.

### Choice-timing principle (sticky, applies to all candidates)

**Local fixes/features get chosen as early as possible in the
migration.** Three checkpoint moments, each a fork-in-the-road for the
candidate:

1. **At categorisation** (current OBSERVE phase) — when a divergent
   item is first identified, present the apply/defer/drop choice
   immediately rather than auto-adding it to a HIGH/MED/LOW slot. The
   migration principle decides default disposition (default = drop);
   user override decides actual disposition.
2. **At issue-pickup** — when an existing issue is about to be worked,
   re-confirm the candidate is still wanted (situations change between
   issue-filing and pickup; verify the gap still exists; verify the
   port is still desirable).
3. **At deploy-time** — when a deploy branch is being created from the
   scaffold, the per-feature branch composition is the final
   accept-or-skip moment.

Together with the minimise-changes principle: the workflow defaults to
"drop everything; opt back in only at explicit choice moments." This
keeps the overlay tree from accreting dead candidates.

**Operational consequence:** future migration sessions (e.g. for HIGH#3
Scope gate) MUST present each candidate as an
AskUserQuestion at categorisation, before any overlay file is created
or any issue is filed. The current session's pattern (categorise → file
→ scaffold → ask) was retro-fixed by closing issue #3 and trimming the
overlay; future sessions avoid the rework by asking earlier.

### HIGH (3 — was 5; SecurityValidator demoted post-investigation, two-root dropped per Decisions Locked)

Each item below MUST pass the migration principle's two bars before its
issue acceptance criteria are met. The verify-first step is the new
first acceptance criterion on each issue.

1. **AskUserQuestion ENUMERATE→OFFER phase-exit gate** — fork's v3.7.0
   gate is the single highest-leverage behavioural fix; v6.3.0 mentions
   AskUserQuestion in `optimize-loop.md` and `v5.7.0.md` but doesn't gate
   it at OBSERVE→THINK. Without this, agents drift past 2–4-option
   decisions silently. *Verify-first: run a v5 session with a deliberate
   enumerable choice; observe whether AskUserQuestion fires unprompted.*
2. **AISTEERINGRULES.md base + `loadAtStartup` wiring** — auto-loaded
   behavioural rules ("Surgical fixes only — never add or remove
   components as a fix", "Never assert without verification", "Build ISC
   from every request", "Ask before destructive actions"). Vanilla v5.0.0
   has none at this path. *Verify-first: grep v5's CLAUDE.md and
   PAI/USER files for equivalent text; port only the rules genuinely
   absent from v5's behaviour.*
3. **Scope gate (Atomic/Simple/Complex hard-block)** — fork's v3.7.0
   `OBSERVE` SCOPE GATE forbids expanding atomic requests
   ("'while I'm there' is forbidden"). v6.3.0 has its own Tier
   Completeness Gate. *Verify-first: ask v5 a deliberately atomic task
   with adjacent tempting work; observe whether it stays scope-locked.*

### DROPPED from HIGH (architectural decision)

- **Two-root architecture (`CLAUDE_CONFIG_DIR` + `PAI_DIR`)** — Ian's
  decision: marrmini stays single-root under `~/.claude/`. The 7
  migration helper files (`pai-paths.ts`, `pai-runtime-migration.ts`,
  `memory-migration{,.test}.ts`, `skill-migration{,.test}.ts`,
  `command-migration.ts`, `exec.ts`) were briefly added to the overlay
  during the v4.0.3+ gap-fix and then removed when this decision
  surfaced. Issue #3 on `virtualian/pai-v5` closed as won't-do.

### MED

6. **AgentExecutionGuard hook** — guards against agent self-recursion;
   useful but not daily-blocking
7. **SkillGuard hook** — guards skill invocation patterns; v5 has
   alternative invocation governance
8. **Pre-read sweep gate (Algorithm)** — v3.7.0 BUILD-phase HARD BLOCK
   that batches Read calls before any Edit; eliminates serial
   read-edit-read cycles
9. **Dependency analysis micro-phase (Algorithm)** — v3.7.0 PLAN-exit
   gate that forces parallel-track planning
10. **Learning standalone pack (`~/.pai/skills/Learning/`)** — closes
    the `/learn` curation loop with PENDING/ACCEPTED/DEFERRED/REJECTED/
    APPLIED proposal lifecycle and force-loaded AISTEERINGRULES write
    target. v5 has substantial *automated capture* (5 hooks, weekly
    `LearningPatternSynthesis.ts` CLI, WisdomFrames with CRYSTAL
    confidence) but **no human curation loop** — and v5's system prompt
    counter-recommends harness auto-memory for behavioural rules,
    creating a doctrinal conflict to resolve at port time. Integration
    design (port-side + community survey of v5 forks) tracked in #169.
    See `reports/v5-learning-loop-vs-pack.md`.
11. **Skill-listing budget bump (overlay-only)** — addresses skill-budget
    overflow surfaced in `marrmini-environment.txt` by raising
    `skillListingBudgetFraction` / `skillListingMaxDescChars` in the
    Class-B `settings.json` merge (see item #13). v5 source is not
    modified. Accepted trade-off: ~16k tokens/session ongoing. Per-skill
    `SKILL.md` description curation (ISA, BeCreative, Interview, +1 more)
    deferred to issue #168.
12. **SessionAutoName hook (525 LOC)** — UX nicety; auto-names sessions
    from initial prompt
13. **settings.json customisations (Class B merge)** — fork-side keys
    (`autoUpdatesChannel`, `effortLevel`, `enableAllProjectMcpServers`,
    `enabledMcpjsonServers`, `mcpServers`, `remoteControlAtStartup`,
    `showThinkingSummaries`, `skillListingBudgetFraction`,
    `skillListingMaxDescChars`, `verbose`)

### LOW

15. **DA_IDENTITY / mode classification fork-style** — v5 has its own
    Sonnet classifier at UserPromptSubmit (`PromptProcessing.hook.ts`);
    likely better than fork's mode classification; do not port
16. **Algorithm v3.7.0 doctrine bits not covered above** — mostly
    superseded by v6.3.0's ISA pattern + closed-enumeration thinking
    capabilities + Capability-Name Audit Gate

## Drop List

| Item | Why dropped |
|---|---|
| Voice removal cascade (de-wiring of voice from hooks) | v5's `voiceEnabled: false` in `settings.json` achieves fork's intent without de-wiring; the Class-B settings overlay sets this key |
| ISC count gate (Standard 8 / Extended 16 / Advanced 24 / Deep 40 / Comprehensive 64) | REPLACED by v5's stricter tier floors (E2≥16, E3≥32, E4≥128, E5≥256) |
| `~/.claude/VoiceServer/` legacy directory on marrair | Residue from before voice removal; v5 manages voice via `VoiceCompletion.hook.ts` + `~/.claude/PAI/PULSE/VoiceServer/voice.ts` |
| Marrair-only debug scripts that don't fit v5's architecture | TBD enumeration during Phase B trial sessions; not pre-listed here |
| SecurityValidator hook (642 LOC) + audit-log writer | v5's `hooks/SecurityPipeline.hook.ts` self-documents (L4–L7) as replacing it with a composable `Pattern → Egress → Rules` inspector chain. v5's `PatternInspector.ts` consumes a **largely compatible** `patterns.yaml` shape (same `version` / `philosophy` / `bash` / `paths` / `projects` top-level; v5 has `bash.trusted` allowlist where fork has `bash.confirm` user-prompt — port-time consideration only if a user has custom `bash.confirm:` rules). PatternInspector is **fail-closed** on missing patterns (L200) where fork is fail-open. v5 ships `PATTERNS.yaml` (156 lines) in baseline. No documented residual gap. Verify-first probe deferred to Phase B trial sessions; promote back if a concrete gap surfaces. |
| `PAISECURITYSYSTEM/patterns.example.yaml` | No purpose without SecurityValidator (above). v5 ships its own `~/.claude/PAI/USER/SECURITY/PATTERNS.yaml`. |

## Adopt List (vanilla v5.0.0 keeps verbatim)

- **Algorithm v6.3.0 baseline** — ISA pattern (12-section system of record),
  closed-enumeration thinking-capability audit gate (NEW v6.3.0), Sonnet
  classifier at UserPromptSubmit, `/e1`–`/e5` effort overrides,
  ideate/optimize loop modes, `optimize-loop.md`, `mode-detection.md`,
  `eval-guide.md`, `parameter-schema.md`, `target-types.md`
- **~40-hook set as baseline** — fork-side hooks added on top via
  overlay are MED-priority only (AgentExecutionGuard, SkillGuard,
  SessionAutoName); no HIGH-priority hook ports survive
  verify-against-v5
- **New v5 settings.json keys** — `allowedHttpHookUrls`, `autoMode`,
  `awaySummaryEnabled`, `httpHookAllowedEnvVars`, `includeGitInstructions`,
  `max_tokens`, `observability`, `postCompactRestore`, `spinnerTipsOverride`,
  `spinnerVerbs`, `worktree`
- **PULSE observability surface** — fork didn't have it
- **PAI-Install** — already deployed on marrmini

## Personalisation Transfer List (Class C — copy once at Phase C cutover)

These get copied marrair → marrmini ONCE at the cutover moment, then left
alone. They auto-update from there (via `/learn`, auto-memory, `/interview`,
etc.) and are NEVER in the overlay.

| Source on marrair | Target on marrmini | Why Class C |
|---|---|---|
| `~/.pai/PAI/USER/PRINCIPAL_IDENTITY.md` | `~/.claude/PAI/USER/PRINCIPAL_IDENTITY.md` | Auto-updated by `/interview` |
| `~/.pai/PAI/USER/DA_IDENTITY.md` | `~/.claude/PAI/USER/DA_IDENTITY.md` | Auto-updated by `/interview` |
| `~/.pai/PAI/USER/AISTEERINGRULES.md` | `~/.claude/PAI/USER/AISTEERINGRULES.md` | Auto-extended by `/learn` (user-overrides file; distinct from system AISTEERINGRULES which IS in overlay) |
| `~/.pai/PAI/USER/RESUME.md` | `~/.claude/PAI/USER/RESUME.md` | User-edited |
| `~/.pai/PAI/USER/BUSINESS/` | `~/.claude/PAI/USER/BUSINESS/` | User-edited |
| `~/.pai/PAI/USER/OPINIONS.md` | `~/.claude/PAI/USER/OPINIONS.md` | User-edited |
| `~/.pai/PAI/USER/WRITINGSTYLE.md` | `~/.claude/PAI/USER/WRITINGSTYLE.md` | User-edited |
| `~/.pai/PAI/USER/TELOS/` | `~/.claude/PAI/USER/TELOS/` | Updated by Telos skill |
| `~/.pai/PAI/USER/CONTACTS.md` | `~/.claude/PAI/USER/CONTACTS.md` | User-edited |
| `~/.pai/MEMORY/**` | `~/.claude/MEMORY/**` | Active memory tree, AI-written. Single-root since two-root dropped. |
| `~/.claude/CLAUDE-USER.md` | `~/.claude/CLAUDE-USER.md` | User-edited |
| `~/.claude/marr/MARR-USER-CLAUDE.md` | `~/.claude/marr/MARR-USER-CLAUDE.md` | User-edited (MARR project standard) |

**Asymmetric blocker (per parent plan):** MEMORY transfer is
uni-directional. Once marrmini starts writing memory, syncing back from
marrair gets messy. Pick a clean cutover moment — recommended: after the
HIGH-priority ports validate but before any non-trivial daily session
starts on marrmini.

## Sequencing — Follow-up Issues

Each becomes its own issue against `virtualian/pai-v5`. One-issue-at-a-time
per stored preference. HIGH#3 (was two-root, dropped) closed as won't-do.

1. **virtualian/pai-v5#1 (HIGH#1) — Port AskUserQuestion ENUMERATE→OFFER
   phase-exit gate to v5's Algorithm v6.3.0+local**
   - Overlay files (3, on branch `1-port-askuq-gate` cut 2026-05-11):
     - `Releases/v5.0.0-overlay/PAI/ALGORITHM/askuq-gate.md` (88 lines;
       cherry-picked from `bootstrap/v5-overlay-and-tooling`)
     - `Releases/v5.0.0-overlay/PAI/ALGORITHM/v6.3.0+local.md` (new;
       load-order wrapper)
     - `Releases/v5.0.0-overlay/PAI/ALGORITHM/LATEST` (new; `6.3.0+local`)
   - Wiring (Option 3 from #173 decision): bump `LATEST` to `6.3.0+local`
     so v5's `CLAUDE.md` MANDATORY FIRST ACTION lands on
     `v6.3.0+local.md`, whose MANDATORY LOAD SEQUENCE Reads `v6.3.0.md`
     then `askuq-gate.md` before OBSERVE executes. v5's `v6.3.0.md`
     untouched
   - Acceptance: AskUserQuestion is invoked exactly when 2–4-option
     enumerable decisions exist, on the `OPEN_CHOICES:` line, before
     THINK begins
2. **virtualian/pai-v5#2 (HIGH#2) — Port AISTEERINGRULES.md base +
   `loadAtStartup` wiring**
   - Overlay file: `Releases/v5.0.0-overlay/PAI/AISTEERINGRULES.md` (95
     lines, verbatim from marrair runtime; already populated this session)
   - Wiring: `settings.json.overlay` adds `{path: PAI/AISTEERINGRULES.md}`
     to the `loadAtStartup` array (already populated this session)
   - Acceptance: rules force-loaded at session start; visible in early
     turns; no regressions in v5's existing `loadAtStartup` entries
3. **~~virtualian/pai-v5#3~~ — closed won't-do** (was: Adopt two-root
   architecture). The 7 migration helper files exist in
   `Releases/v4.0.3+/.claude/PAI-Install/engine/` on `virtualian/pai`
   if the decision ever reverses.

To file in subsequent sessions (HIGH#3 in revised list, picked up one at a time):

4. **(HIGH#3 in revised list) — Port Scope gate (Atomic/Simple/Complex
   hard-block) into v5 OBSERVE phase**
   - New overlay file needed: addendum to v6.3.0 OBSERVE, similar shape
     to `askuq-gate.md`

## marrair Decommission Criteria

marrair PAI install is decommissioned (Phase D) when ALL of the following
are true and have been validated by ≥1 week of daily use on marrmini:

1. HIGH#1 (AskUserQuestion ENUMERATE→OFFER) ported and validated on
   marrmini
2. HIGH#2 (AISTEERINGRULES.md + loadAtStartup wiring) ported and
   validated; rules visible in session intro
3. Personalisation transfer (Class C) completed: PRINCIPAL_IDENTITY,
   DA_IDENTITY, USER overrides, MEMORY tree all on marrmini under
   `~/.claude/` (single-root layout, since two-root not implemented)
4. `pai` REPL on marrmini functionally equivalent to marrair's daily
   experience (subjective; validated by Ian)
5. ≥7 daily sessions on marrmini complete without falling back to marrair
   for any task

(Originally 6 conditions; condition #3 ("two-root architecture ported")
removed when two-root was dropped.) HIGH#3 (Scope gate) in the revised
priority list is NOT decommission-blocking — it is a quality-of-life
port that can land post-Phase-D.

After all of the above conditions hold:
- Tag `marrair-pai-final` on `virtualian/pai`'s current branch
- Add `~/.pai/DECOMMISSIONED.md` marker on marrair
- Stop running `claude --dangerously-skip-permissions` on marrair
- Archive `virtualian/pai` repo on GitHub (Settings → Archive)
- Keep `~/backups/pai/runtime-marrair-20260508-002618/` indefinitely as
  archaeological reference

## Phased Move (recap from parent plan)

| Phase | When | marrair role | marrmini role |
|---|---|---|---|
| **A** | Through Step 9 (#166 PR) | primary | runtime probes, overlay-tree setup |
| **B** | After Step 11 (this doc) names HIGH-priority ports | primary | HIGH ports landed on overlay; trial sessions surface friction |
| **C** | After HIGH ports validate on marrmini | fallback only (~2–4 weeks) | primary |
| **D** | After validation period | decommissioned | sole PAI host |

This session opens Phase B by:
1. Creating `virtualian/pai-v5` (linked fork of upstream)
2. Replacing `marrmini:~/projects/pai/` with `~/projects/pai-v5/`
3. Scaffolding `Releases/v5.0.0-overlay/` with HIGH#1, #2 overlay files
4. Writing `Tools/deploy-overlay.sh` and `Tools/check-overlay.sh`
5. Filing the first 3 follow-up issues against `virtualian/pai-v5`

Phase B's first daily-work session can begin once issue #1 (AskUserQuestion
gate) is picked up.

## What This Session Did NOT Do

Per parent plan's Step 11 sketch:

- Did NOT generate Step 10's full multi-day prose comparison report (the
  8 per-area prose sections); the targeted diff in OBSERVE was sufficient
  to drive HIGH/MED/LOW ranking
- Did NOT execute `deploy-overlay.sh` against marrmini's live `~/.claude/`
  (Phase B's first session does that, after HIGH#1 is picked up)
- Did NOT open a PR back to `virtualian/pai`'s `main` (Step 12; separate
  approval)
- Did NOT touch marrair's PAI runtime (only read the snapshot)
- Did NOT do personalisation transfer (Phase C)

## Progress / Status (as of 2026-05-10)

Tracking what has actually landed versus what the doc *plans for*. Updated
on each `166-…` branch that revisits status; the design doc itself remains
the source of truth for *what should happen*.

### Issue #166 playbook (this repo)

All 12 playbook steps from the issue body are functionally complete.
Evidence:

| Step | Status | Evidence |
|---|---|---|
| 1. Tag `pre-v5-baseline-shift` on marrair | ✅ | `git tag` shows `pre-v5-baseline-shift` |
| 2. Branch `sync/v5-baseline-shift` on marrair | ✅ | merged via PR #167 |
| 3. Snapshot marrair runtime | ✅ | `~/backups/pai/runtime-marrair-20260508-002618/` |
| 4. Secret-scan hygiene log | ✅ | `reports/v5-comparison/scan-log.txt` |
| 5. Prepare marrmini (decommission existing PAI) | ✅ | `~/backups/pai/marrmini-pre-v5-20260508-002618/` |
| 6. Clone fork, archive marrair clone | ✅ | `marrair-final` tag |
| 7. Clean v5.0.0 install on marrmini | ✅ | `~/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/` |
| 8. Snapshot post-install marrmini | ✅ | snapshot above |
| 9. Freeze `Releases/v4.0.3+/` | ✅ | `v4.0.3+-final` tag |
| 10. Comparison report | ✅ | targeted diff used in lieu of multi-day prose (per "What This Session Did NOT Do") |
| 11. Design doc | ✅ | this file; landed via PR #167, refined via PR #170 |
| 12. Open PR `sync/v5-baseline-shift` → `main` | ✅ | PR #167 merged 2026-05-09, PR #170 merged 2026-05-10 |

### Follow-up issues on `virtualian/pai-v5`

| ID | Title | State |
|---|---|---|
| `virtualian/pai-v5#1` | Port AskUserQuestion ENUMERATE→OFFER phase-exit gate to Algorithm v6.3.0+local (HIGH#1) | OPEN — overlay files authored on branch `1-port-askuq-gate` (askuq-gate.md cherry-picked + new v6.3.0+local.md wrapper + LATEST→`6.3.0+local`); deploy + acceptance verify on marrmini pending |
| `virtualian/pai-v5#2` | Port AISTEERINGRULES.md base + `loadAtStartup` wiring (HIGH#2) | OPEN — overlay file + settings.json.overlay wiring populated; runtime verification pending |
| `virtualian/pai-v5#3` | Adopt two-root architecture | CLOSED won't-do — per Decisions Locked |

### Related issues filed in `virtualian/pai`

- `#168` — Curate `SKILL.md` descriptions to fit default skill-listing
  budget (referenced from MED item #11)
- `#169` — Investigate v5 Learning Loop integration — port-side curation
  layer + community research (referenced from MED item #10)
- `#173` — Track pai-v5#1 port: record Option 3 wiring decision
  (LATEST→6.3.0+local) in design doc (this document's updates)

### Overlay scaffold state on `virtualian/pai-v5:bootstrap/v5-overlay-and-tooling`

Audited 2026-05-10. Findings detailed in
[`reports/v5-comparison/v5-overlay-audit.md`](../reports/v5-comparison/v5-overlay-audit.md).

- **Matches design:** README, AISTEERINGRULES.md (95-line runtime), askuq-gate.md, repo-url.ts, WorkArchival.ts, preserve-claudemd{,.test}.ts, settings.json.overlay (partial), deploy-overlay.sh, check-overlay.sh. Seven two-root migrators correctly absent.
- **Drifts from design (PR #170 not yet applied to overlay):**
  `hooks/SecurityValidator.hook.ts` (19.4 KB) still present;
  `README.md` overlay-contents table still documents it Class A;
  `settings.json.overlay` still wires it under `hooks.PreToolUse`.
  Per PR #170 demotion these three sites need cleanup. Recommendation:
  file a cleanup issue on `virtualian/pai-v5` against the scaffold
  branch, gated on a Phase-B trial-session probe to confirm no
  concrete destructive-pattern gap surfaces under v5's
  SecurityPipeline + PatternInspector chain.
- **Not yet captured (by design, deferred):** MED-priority
  `settings.json` keys (item #13 — `autoUpdatesChannel`,
  `skillListingBudgetFraction`, etc.), Scope gate overlay file (HIGH#3
  in revised list), MED items 6–12.

### Phase posture

Currently mid-**Phase B** (per "Phased Move" table): design doc landed,
overlay scaffold populated for HIGH#1/#2, **pai-v5#1 (HIGH#1) in flight**
on branch `1-port-askuq-gate` (overlay files authored 2026-05-11; deploy
+ acceptance verify on marrmini pending). Marrair remains primary.
marrmini decommission criteria (this doc, lines 358–377) are 0 of 5
satisfied — HIGH#1 and HIGH#2 still need overlay-deploy + runtime
validation on marrmini before Phase C cutover.

## References

- Parent plan: [`Plans/v5-0-0-is-a-major-keen-wall.md`](v5-0-0-is-a-major-keen-wall.md)
- Issue: [virtualian/pai#166](https://github.com/virtualian/pai/issues/166)
- Personal fork: [`virtualian/pai-v5`](https://github.com/virtualian/pai-v5)
- Snapshots:
  - `~/backups/pai/runtime-marrair-20260508-002618/` (live fork runtime)
  - `~/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/` (vanilla v5.0.0)
- Environment capture: [`reports/v5-comparison/marrmini-environment.txt`](../reports/v5-comparison/marrmini-environment.txt)
