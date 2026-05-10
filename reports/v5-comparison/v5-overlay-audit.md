# v5.0.0 Overlay Audit — `virtualian/pai-v5:bootstrap/v5-overlay-and-tooling`

**Audited:** 2026-05-10
**Against:** `Plans/v5-0-0-plus-port.md` (as of `f92eafe`, post-PR #170)
**Branch:** `virtualian/pai-v5:bootstrap/v5-overlay-and-tooling`
**Issue:** virtualian/pai#166

## Method

Listed the overlay tree on the scaffold branch via `gh api`
(`/repos/virtualian/pai-v5/git/trees/bootstrap/v5-overlay-and-tooling?recursive=1`,
filtered to `Releases/v5.0.0-overlay/`), then read the `README.md`,
`settings.json.overlay`, and key prose files (`AISTEERINGRULES.md`,
`PAI/ALGORITHM/askuq-gate.md`). Compared file-by-file against the design
doc's "Overlay path strategy" (lines 82–137), "Drop List" (lines 268–278),
and "Decisions Locked" / two-root drop (lines 31, 215–222). Also checked
`Tools/{deploy,check}-overlay.sh` for presence and content.

## Overlay tree (actual, on `bootstrap/v5-overlay-and-tooling`)

```
Releases/v5.0.0-overlay/
├── README.md                                    (6687 B)
├── settings.json.overlay                        (1119 B)
├── PAI/
│   ├── AISTEERINGRULES.md                       (13334 B — 95-line runtime version)
│   ├── ALGORITHM/
│   │   └── askuq-gate.md                        (populated; addendum to v6.3.0 OBSERVE)
│   ├── PAI-Install/
│   │   └── engine/
│   │       └── repo-url.ts
│   └── TOOLS/
│       ├── WorkArchival.ts
│       ├── preserve-claudemd.ts
│       └── preserve-claudemd.test.ts
└── hooks/
    └── SecurityValidator.hook.ts                (19441 B)
```

Tooling at repo root (`Tools/`):

- `deploy-overlay.sh` (3217 B) — rsync + jq merge as designed
- `check-overlay.sh` (3590 B) — drift detector as designed
- `BackupRestore.ts`, `validate-protected.ts`, `utilities-icon.png` — pre-existing repo tooling, unrelated to overlay

## Findings

### GREEN — overlay matches design

| Item | Design doc reference | Status |
|---|---|---|
| `README.md` documenting deploy classes A/B/C/D | lines 120–137 | ✅ present |
| `PAI/AISTEERINGRULES.md` (system, 95-line runtime) | line 91 + 134–137 | ✅ present, size consistent with 95 lines |
| `PAI/ALGORITHM/askuq-gate.md` (synthesised addendum) | line 92 | ✅ present, populated |
| `PAI/PAI-Install/engine/repo-url.ts` (v4-only, NOT in 7-helper drop set) | line 102 vs lines 218–221 | ✅ correctly kept |
| `PAI/TOOLS/WorkArchival.ts` (v4-only) | line 104 | ✅ present (MED-priority candidate) |
| `PAI/TOOLS/preserve-claudemd.ts` + test (v4-only) | line 105 | ✅ present (MED-priority candidate) |
| 7 two-root migration helpers absent | Decisions Locked line 31, drop note lines 215–222 | ✅ correctly absent (`pai-paths.ts`, `pai-runtime-migration.ts`, `memory-migration{,.test}.ts`, `skill-migration{,.test}.ts`, `command-migration.ts`, `exec.ts`) |
| `Tools/deploy-overlay.sh` (rsync + jq merge) | line 116 | ✅ present, functional |
| `Tools/check-overlay.sh` (drift detector) | line 117 | ✅ present, functional |
| `settings.json.overlay` wires `PAI/AISTEERINGRULES.md` into `loadAtStartup` | sequencing item #2 lines 342–344 | ✅ wired |
| `settings.json.overlay` sets `voiceEnabled: false` | drop-list line 272 | ✅ wired |

### RED — overlay drifts from design (post-PR #170 demotion)

PR #170 ("Refine v5.0.0+ port design: demote SecurityValidator, refresh
Learning scope") moved SecurityValidator from the HIGH-priority port list
to the **Drop List** (design doc lines 276–277). Rationale:

> v5's `hooks/SecurityPipeline.hook.ts` self-documents (L4–L7) as
> replacing it with a composable `Pattern → Egress → Rules` inspector
> chain... PatternInspector is fail-closed on missing patterns where
> fork is fail-open. v5 ships `PATTERNS.yaml` (156 lines) in baseline.
> No documented residual gap. Verify-first probe deferred to Phase B
> trial sessions; promote back if a concrete gap surfaces.

The overlay scaffold predates this demotion and still treats
SecurityValidator as an active Class-A port. Three drift sites:

1. **`hooks/SecurityValidator.hook.ts`** — 19441-byte hook present in
   overlay tree. Per design doc this should NOT be in overlay.

2. **`README.md` overlay-contents table** — documents
   `hooks/SecurityValidator.hook.ts` as Class A, citing "vanilla v5.0.0
   has SecurityPipeline + ContentScanner + PromptGuard + ContainmentGuard
   but lacks the per-pattern destructive-intent gate." This rationale was
   the basis on which PR #170 explicitly demoted the port (the gap is
   not documented, v5's chain is held to be sufficient until a concrete
   gap surfaces).

3. **`settings.json.overlay` `hooks.PreToolUse[]` entry** — wires
   `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/SecurityValidator.hook.ts`
   under matcher `Bash|Edit|Write|Read`. With the hook dropped, this
   entry has no target.

Net: a follow-up commit on the `bootstrap/v5-overlay-and-tooling` branch
(or a per-issue branch cut from it) needs to:

- Delete `hooks/SecurityValidator.hook.ts`
- Strip the SecurityValidator row from `README.md`
- Strip the `hooks.PreToolUse` entry from `settings.json.overlay`

### AMBER — settings.json MED-priority keys not captured

Design doc item #13 (lines 256–258) enumerates fork-side `settings.json`
customisations as a Class-B MED-priority merge:

> `autoUpdatesChannel`, `effortLevel`, `enableAllProjectMcpServers`,
> `enabledMcpjsonServers`, `mcpServers`, `remoteControlAtStartup`,
> `showThinkingSummaries`, `skillListingBudgetFraction`,
> `skillListingMaxDescChars`, `verbose`

Current `settings.json.overlay` carries only `loadAtStartup`,
`voiceEnabled`, and the (stale) `hooks.PreToolUse` entry. The
MED-priority keys are not yet present. This is consistent with their
MED priority — they're sequenced for later — but the overlay should
eventually capture them, and item #11 (skill-listing budget bump) lists
`skillListingBudgetFraction` / `skillListingMaxDescChars` as the
specific fix for the documented skill-budget overflow.

Not a defect against the current state of the playbook; flagged here so
it doesn't disappear from view.

### OPEN — by design

These are absent because the design doc explicitly defers them:

- **Scope gate overlay file** (HIGH#3 in revised priority list,
  formerly HIGH#5) — design doc line 354 says "To file in subsequent
  sessions"; no overlay file yet.
- **MED items 6–12** — AgentExecutionGuard hook, SkillGuard hook,
  pre-read sweep gate, dependency-analysis micro-phase, Learning
  standalone pack, skill-listing budget bump, SessionAutoName hook —
  none yet in overlay; per sequencing principle, each becomes its own
  per-issue branch when picked up.

## Recommended follow-ups (NOT executed in this audit)

1. **File a `bootstrap`-branch cleanup issue on `virtualian/pai-v5`** —
   remove the three SecurityValidator drift sites from
   `bootstrap/v5-overlay-and-tooling`. Title: "Remove SecurityValidator
   from overlay scaffold (per PR #170 demotion)."
2. **Re-confirm the demotion empirically before cleanup** — design doc
   says "promote back if a concrete gap surfaces." A Phase-B trial
   session on marrmini exercising destructive bash patterns
   (`rm -rf` near `$HOME`, broad chmod, etc.) under v5's
   SecurityPipeline + PatternInspector chain should be the trigger for
   keep-or-delete.
3. **Track skill-listing budget keys as the first MED-priority
   `settings.json` candidate** when item #11 / #13 is picked up; the
   marrmini-environment.txt evidence of overflow is already on file.

## References

- Design doc: [`Plans/v5-0-0-plus-port.md`](../../Plans/v5-0-0-plus-port.md)
- PR #167 (initial scaffold): <https://github.com/virtualian/pai/pull/167>
- PR #170 (SecurityValidator demotion): <https://github.com/virtualian/pai/pull/170>
- Bootstrap branch: <https://github.com/virtualian/pai-v5/tree/bootstrap/v5-overlay-and-tooling>
- Follow-up issues filed: `virtualian/pai-v5#1` (AskUQ gate, OPEN),
  `virtualian/pai-v5#2` (AISTEERINGRULES + loadAtStartup, OPEN),
  `virtualian/pai-v5#3` (two-root, CLOSED won't-do)
