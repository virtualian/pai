# v5.0.0 Learning Loop vs Fork's Standalone Learning Pack

**Generated:** 2026-05-10
**Scope:** Read-only comparison of upstream PAI v5.0.0 baseline against the fork's
runtime learning pipeline (Learning skill pack + AISTEERINGRULES + force-load + MEMORY).
**Sources:**
- v5 baseline tree: `/Users/ianmarr/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/.claude/`
- Fork runtime: `/Users/ianmarr/.pai/`, `/Users/ianmarr/.claude/`
- Fork release source: `/Users/ianmarr/projects/pai/Releases/v4.0.3+/.claude/`

---

## 1. TL;DR

v5 has a **substantial automated learning pipeline** but **no human curation
loop**. Hooks capture ratings, work-completion learnings, failure dumps and
relationship notes; a `LearningPatternSynthesis.ts` tool aggregates ratings into
weekly synthesis files; `LoadContext.hook.ts` reads five compact summaries back
into every session. There is **no `/learn` skill, no `AISTEERINGRULES.md`, no
PENDING/ACCEPTED/APPLIED proposal lifecycle, and no force-loaded steering
file**. The fork's pack adds exactly that missing curation layer (`/learn check
| review | apply`) plus a force-loaded `AISTEERINGRULES.md` written
incrementally by approved Learning proposals. v5 reads patterns into context;
the fork additionally lets the patterns mutate behavioural rules under human
review.

---

## 2. v5 Mechanism (Five Dimensions)

### 2.1 Trigger surface

v5 captures signals **automatically and passively** via hooks. There is no
slash command, skill, or user-facing curation entrypoint that maps to "learn"
in v5.

Evidence — `settings.json` hook wiring (lines 240-275, 300-315):

```
SessionEnd: WorkCompletionLearning, SessionCleanup, RelationshipMemory, ...
UserPromptSubmit: PromptProcessing, SatisfactionCapture (async, timeout 20)
```

Triggers in detail:

- `SatisfactionCapture.hook.ts` (UserPromptSubmit): every user prompt;
  detects explicit ratings ("8"), positive praise fast-paths, or runs LLM
  inference for implicit sentiment (`SatisfactionCapture.hook.ts:313`,
  `:336`, `:370`, `:398`).
- `WorkCompletionLearning.hook.ts` (SessionEnd): captures one learning per
  significant work session (`WorkCompletionLearning.hook.ts:259`,
  `:357-368`).
- `RelationshipMemory.hook.ts` (SessionEnd): extracts W/B/O notes per
  session (`RelationshipMemory.hook.ts:1-29`).
- `LearningPatternSynthesis.ts` (`PAI/TOOLS/`): CLI tool, runs on demand
  (`--week | --month | --all`); not automated by default — it must be invoked
  manually or by a cron the user adds (`LearningPatternSynthesis.ts:300-323`).

There is **no skill named Learning** under `/Users/ianmarr/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/.claude/skills/`
(`ls skills/` returns 47 dirs, none matching `*Learn*`).

### 2.2 Capture / curation step

Capture is per-event, hook-local. There is **no batch curation step** between
capture and load-back; only the optional `LearningPatternSynthesis.ts` rolls
ratings up into weekly clusters.

Evidence:

- `SatisfactionCapture.hook.ts:158-163` writes JSON lines to
  `MEMORY/LEARNING/SIGNALS/ratings.jsonl`.
- `SatisfactionCapture.hook.ts:166-225` (`captureLowRatingLearning`) writes
  per-rating markdown to `MEMORY/LEARNING/{ALGORITHM|SYSTEM}/YYYY-MM/`
  whenever rating < 5.
- `SatisfactionCapture.hook.ts:355-365` calls `captureFailure()` for ratings
  ≤ 3 — full transcript dump to `MEMORY/LEARNING/FAILURES/YYYY-MM/<slug>/`
  (`PAI/TOOLS/FailureCapture.ts:1-26`).
- `WorkCompletionLearning.hook.ts:188-256` writes work-completion learnings
  to `MEMORY/LEARNING/{ALGORITHM|SYSTEM}/YYYY-MM/`.
- `learning-utils.ts:8-56` defines the regex-based `getLearningCategory()`
  classifier (ALGORITHM vs SYSTEM) shared by both capture hooks.
- Categorisation is regex-based, not LLM-curated; deduplication is
  filename-based only (`WorkCompletionLearning.hook.ts:202-206`: "Don't
  overwrite existing learnings").
- WisdomFrames are hand-promoted via `PAI/TOOLS/WisdomFrameUpdater.ts`
  (CLI tool, `--from-session` flag — `WisdomFrameUpdater.ts:6-14`); no hook
  fires this automatically.

### 2.3 Write target

Multiple parallel sinks, all under `~/.claude/PAI/MEMORY/`:

| Sink | Writer | Format |
|---|---|---|
| `LEARNING/SIGNALS/ratings.jsonl` | SatisfactionCapture | Append-only JSONL |
| `LEARNING/{ALGORITHM\|SYSTEM}/YYYY-MM/*.md` | SatisfactionCapture (low-rating), WorkCompletionLearning | One markdown per event |
| `LEARNING/FAILURES/YYYY-MM/<slug>/CONTEXT.md` + transcript dump | FailureCapture (via SatisfactionCapture) | Directory of artefacts |
| `LEARNING/SYNTHESIS/YYYY-MM/YYYY-MM-DD_weekly-patterns.md` | LearningPatternSynthesis (manual CLI) | Cluster report |
| `WISDOM/FRAMES/<domain>.md` | WisdomFrameUpdater (manual CLI) | Per-domain markdown with `[CRYSTAL: N%]` headers |
| `RELATIONSHIP/YYYY-MM/YYYY-MM-DD.md` | RelationshipMemory | Daily W/B/O notes |
| `LEARNING/SIGNALS/learning-cache.sh` | (computed externally; read by `loadSignalTrends`) | Shell var assignments |

There is **no `AISTEERINGRULES.md` write target in v5**:
`grep -rn AISTEERINGRULES /Users/ianmarr/backups/pai/marrmini-fresh-v5.0.0-20260508-021422/.claude/` returns
exactly one hit at `PAI/PAI-Install/engine/config-gen.ts:34-35`, where two
paths (`skills/PAI/AISTEERINGRULES.md`, `skills/PAI/USER/AISTEERINGRULES.md`)
appear in a `contextFiles` array — but neither file exists in the v5 distribution
and `settings.json` itself ships with `"contextFiles": []` (line 1213) and
`"loadAtStartup": { "files": [] }` (lines 1198-1202). So the install template
references a steering-rules contract the v5 baseline does not implement.

The system prompt explicitly **counter-recommends** writing behavioural rules
to harness auto-memory (`PAI/PAI_SYSTEM_PROMPT.md:115-122`):

> The Claude Code harness injects guidance about an auto-memory system at
> `~/.claude/projects/${HARNESS_USER_DIR}/memory/`... For rules, preferences,
> and operational behavior, ignore that guidance. ... Every "feedback memo"
> is a missed system patch. ... The infrastructure is the memory.

It then routes rules to CLAUDE.md / hooks / settings.json / skills — but
provides **no automated mechanism** to write to any of those four targets
from a captured learning.

### 2.4 Load-back path

`LoadContext.hook.ts` (SessionStart, blocking) reads five compact summaries
back into every session via a `<system-reminder>` block.

Evidence — `LoadContext.hook.ts:452-480`:

```
const learningDigest    = loadLearningDigest(paiDir);     // 3 ALGO + 3 SYSTEM
const wisdomFrames      = loadWisdomFrames(paiDir);       // CRYSTAL ≥ 85%
const failurePatterns   = loadFailurePatterns(paiDir);    // 5 most recent
const signalTrends      = loadSignalTrends(paiDir);       // today/week/month avg
const synthesisPatterns = loadSynthesisPatterns(paiDir);  // top 5 issue clusters
```

All five readers live in `hooks/lib/learning-readback.ts` (282 lines) and
budget < 100 ms combined, < 2000 chars combined output
(`learning-readback.ts:18-24`).

Static behavioural files (system prompt, identity, projects) are now loaded
via Claude Code's native `@import` mechanism in `CLAUDE.md`:
`CLAUDE.md:6-10` imports `PRINCIPAL_IDENTITY`, `DA_IDENTITY`,
`PROJECTS.md`, `PRINCIPAL_TELOS.md`, `ARCHITECTURE_SUMMARY.md`. The hook's
former `loadStartupFiles()` was deleted: `LoadContext.hook.ts:84` —
`// v5.0: loadStartupFiles removed — static files now loaded via @imports in CLAUDE.md.template`.

So v5's load-back is **read-only**: it surfaces patterns the model can
choose to act on, but nothing structurally enforces those patterns; there
is no force-loaded steering file in the loop.

### 2.5 Verification / drift detection

Largely silent on this dimension. There is no proposal lifecycle to drift
between, no committed-source vs runtime split for learning rules, and no
force-load whose presence/content can drift.

The closest analogues:

- `IntegrityCheck.hook.ts` (SessionEnd) — referenced from `settings.json:266`
  and the v5 README diagram at line 87; runs PAI + doc-drift detection.
- WisdomFrames carry `[CRYSTAL: N%]` confidence percentages
  (`learning-readback.ts:106-135`), and the readback only surfaces frames
  ≥ 85%. This is a maturity gate, not a drift detector.
- `FailureCapture.ts` exists explicitly to enable retroactive analysis
  (`FailureCapture.ts:5-7`), but no tool consumes the failure dumps to
  detect recurring patterns vs prior captures.

---

## 3. Fork Learning Loop Mechanism (Five Dimensions)

The fork's loop is composite: **the Learning skill pack is one component, but
the loop also includes `/learn` invocation routing, `AISTEERINGRULES.md`
force-load, the per-cwd auto-memory the system-prompt re-embraces, and the
hook-side capture pipeline that overlaps with v5.**

### 3.1 Trigger surface

Three surfaces:

1. **`/learn check | review | apply`** (skill-routed slash command). The skill
   itself lives at `/Users/ianmarr/.pai/skills/Learning/SKILL.md`; matching is
   by the skill name in available-skills (`SKILL.md:1-3`). There is no
   standalone command file at `/Users/ianmarr/.claude/commands/learn.md`
   (`ls /Users/ianmarr/.claude/commands/` shows only `context-search.md`) —
   so dispatch is via the Skill tool, not via Claude Code's commands directory.
2. **Implicit/keyword phrases** from the skill description — "what have we
   learned", "close the loop", "improve the algorithm", etc.
   (`SKILL.md:3`).
3. **Hook capture surface** (same shape as v5): `RatingCapture.hook.ts` on
   UserPromptSubmit, `WorkCompletionLearning.hook.ts` on SessionEnd. Same
   classifier code (`hooks/lib/learning-utils.ts` is byte-identical to v5
   except whitespace; verified by diff). Algorithm LEARN phase 7/7 also
   writes `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
   (`Releases/v4.0.3+/.claude/PAI/Algorithm/v3.7.0.md:467-473` shows the
   echo-append shell snippet).

### 3.2 Capture / curation step

This is where the fork diverges materially from v5. The Learning pack adds
a **three-stage human-in-the-loop curation pipeline** layered on top of the
hook captures:

1. **Check** (`Workflows/Check.md`): spawns two parallel mining agents
   (Reflection Miner, Ratings Miner) that read the JSONL inputs, cross-
   reference them, and write `MEMORY/LEARNING/mine-output.md` and
   `MEMORY/LEARNING/last-synthesis.md`
   (`Check.md:79-178`, `:196-273`). Severity assigned (CRITICAL / HIGH /
   MODERATE — `Check.md:191-194`).
2. **Review** (`Workflows/Review.md`): classifies each candidate to one of
   three targets — Algorithm spec / `AISTEERINGRULES.md` / feedback
   memories — via a routing table (`Review.md:62-71`); generates
   LP-numbered proposals; writes `MEMORY/LEARNING/review.md` with
   PENDING / ACCEPTED / DEFERRED / REJECTED status per proposal
   (`Review.md:155-172`); deduplicates against prior proposals
   (`Review.md:140-148`).
3. **Apply** (`Workflows/Apply.md`): two-gate apply — first invocation
   generates `MEMORY/LEARNING/staged-changes.md` with diffs and
   default-unchecked checkboxes (`Apply.md:88-118`); second invocation
   applies only checked diffs and updates review.md statuses to APPLIED
   (`Apply.md:144-185`).

`MineRatings.ts` (`/Users/ianmarr/.pai/skills/Learning/Tools/MineRatings.ts`,
11811 bytes) is the analytical CLI tool used by Check.

### 3.3 Write target

Three concrete targets, plus all the hook-driven sinks the fork shares with v5:

| Target | Path | Writer | Persistence |
|---|---|---|---|
| **AISTEERINGRULES.md** | `~/.pai/PAI/AISTEERINGRULES.md` (95 lines, runtime) | Apply workflow → Edit (append to section) | Permanent; force-loaded |
| Algorithm spec | `~/.pai/PAI/Algorithm/v{N}.md` | Apply workflow → Edit (section-aware) | Permanent |
| Feedback memories | `~/.claude/projects/<slug>/memory/feedback_*.md` | Apply workflow → Write (new file) | Permanent; loaded by harness |
| Synthesis intermediates | `MEMORY/LEARNING/{mine-output,last-synthesis,review,staged-changes}.md` | Check / Review / Apply workflows | review.md persistent; others transient |
| Algorithm reflections | `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` | Algorithm LEARN phase 7/7 | Append-only JSONL |
| Ratings, low-rating learnings, failures | Same as v5 | RatingCapture + WorkCompletionLearning | Same |

The user-prompted location `/Users/ianmarr/.pai/AISTEERINGRULES.md` does
**not** exist; the actual file is at `/Users/ianmarr/.pai/PAI/AISTEERINGRULES.md`.
The settings load path uses `PAI/AISTEERINGRULES.md` relative to `PAI_DIR=~/.pai`
(`settings.json:272-278`).

The system-prompt-level guidance in the fork is the inverse of v5's: rather
than discouraging harness auto-memory, the fork's Learning pack treats
`feedback_*.md` files in `~/.claude/projects/-Users-ianmarr-projects-pai/memory/`
as a first-class apply target for "DO MORE" patterns
(`Review.md:65-70`: "DO MORE patterns become positive reinforcement stored
as feedback memories").

### 3.4 Load-back path

Two parallel mechanisms:

1. **`AISTEERINGRULES.md` force-load** — `settings.json:272-279` lists
   `PAI/AISTEERINGRULES.md` and `PAI/USER/AISTEERINGRULES.md` in
   `loadAtStartup.files`. `LoadContext.hook.ts` (`Releases/v4.0.3+/.claude/hooks/LoadContext.hook.ts:85-110`)
   has `loadStartupFiles()` which reads each file and injects it as a
   `<system-reminder>` block. This is the surface that **structurally
   enforces** approved learnings.
2. **Same five readback functions as v5**, with one missing:
   `learning-readback.ts` in the fork runtime
   (`/Users/ianmarr/.pai/hooks/lib/learning-readback.ts`) is the older
   four-function version — `loadLearningDigest`, `loadWisdomFrames`,
   `loadFailurePatterns`, `loadSignalTrends`. The fork is **missing
   `loadSynthesisPatterns()`** that v5 ships
   (diff confirms v5 has 282 lines; fork runtime has 224 lines and lacks
   the SYNTHESIS reader).
3. **Per-cwd CC auto-memory** — auto-loaded by Claude Code itself from
   `~/.claude/projects/-Users-ianmarr-projects-pai/memory/MEMORY.md`
   (referenced inline in this very session's claudeMd context). The fork
   accumulates `feedback_*.md` and `project_*.md` files there
   (`ls` returns 14 feedback/project files plus `MEMORY.md` index).

So load-back has **three concurrent channels**: force-loaded steering file,
hook-injected learning digest, and harness-native per-cwd auto-memory.

### 3.5 Verification / drift detection

Two explicit drift surfaces, both visible in this session's environment:

1. **Runtime vs Releases drift on `AISTEERINGRULES.md`** — the port plan
   (`/Users/ianmarr/projects/pai/plans/v5-0-0-plus-port.md:60-66`) records
   that the v4 committed copy is 52 lines while the runtime is 95 lines:
   "Auto-extended by `/learn`. … runtime authority." The plan accepts this
   as forward drift by design and assigns runtime as canonical for this
   subtree. `MEMORY.md` records the same: "AISTEERINGRULES.md updated by
   /learn — runtime is canonical for behavioural rules; Releases lags."
2. **HWM-based incremental analysis** — `MineRatings.ts` writes a
   `mine-ratings-hwm.json` file (visible in
   `~/.pai/MEMORY/LEARNING/SIGNALS/mine-ratings-hwm.json`) so subsequent
   Check runs only re-process signals newer than the high-water mark. This
   is incrementality, not drift detection per se.
3. **Proposal-lifecycle dedup** — `Review.md:142-147` checks new candidates
   against existing PENDING / DEFERRED / APPLIED / REJECTED proposals and
   only re-surfaces a REJECTED proposal if the signal has strengthened
   since rejection. This prevents the curation queue from drifting against
   prior human decisions.

The fork has **no automatic drift detector** between the force-loaded
`AISTEERINGRULES.md` runtime copy and the committed `Releases/v4.0.3+/...`
copy. Forward drift is "by design" per the port plan and the fork relies on
manual backport during release cuts.

---

## 4. Contrast Table

| Dimension | v5.0.0 Baseline | Fork (pack + AISTEERINGRULES + force-load + MEMORY) |
|---|---|---|
| **Trigger** | Hooks only (UserPromptSubmit + SessionEnd). No slash command, no skill, no user curation entrypoint. | Skill-routed `/learn check\|review\|apply` plus the same hook capture surface. |
| **Capture / curation** | Per-event hook writes; regex classifier (ALGORITHM vs SYSTEM). Optional `LearningPatternSynthesis.ts` CLI for weekly clusters. WisdomFrames hand-promoted via separate CLI. No proposal lifecycle. | Three-stage human-in-the-loop pipeline: parallel mining agents → cross-referenced synthesis → LP-numbered proposals with PENDING / ACCEPTED / DEFERRED / REJECTED / APPLIED lifecycle → two-gate apply with default-unchecked diff checkboxes. |
| **Write target** | `MEMORY/LEARNING/{SIGNALS,ALGORITHM,SYSTEM,FAILURES,SYNTHESIS}/`, `MEMORY/WISDOM/FRAMES/`, `MEMORY/RELATIONSHIP/`. **No `AISTEERINGRULES.md` write target** — install template references it but the file is not shipped and `settings.json` ships an empty `loadAtStartup.files`. System prompt explicitly counter-recommends harness auto-memory. | Three apply targets: `~/.pai/PAI/AISTEERINGRULES.md` (append), Algorithm spec (section-aware edit), `~/.claude/projects/<slug>/memory/feedback_*.md` (write new). Plus all the same hook sinks v5 has. |
| **Load-back** | `LoadContext.hook.ts` reads five compact summaries (digest, wisdom frames, failure patterns, signal trends, synthesis patterns) and injects as `<system-reminder>`. Static files migrated to native CLAUDE.md `@imports`. No force-load. Read-only — model may act on patterns but nothing structurally enforces. | Three concurrent channels: (a) `loadAtStartup.files` force-injects `PAI/AISTEERINGRULES.md` + `PAI/USER/AISTEERINGRULES.md` as `<system-reminder>` blocks; (b) the same `LoadContext.hook.ts` readback functions as v5 **minus `loadSynthesisPatterns()`** (fork runtime is one function behind v5); (c) Claude Code's native per-cwd auto-memory loads `feedback_*.md`. |
| **Verification / drift** | Largely silent. `IntegrityCheck.hook.ts` covers PAI + doc drift but not learning. WisdomFrames `[CRYSTAL: %]` confidence is a maturity gate, not drift detection. | Forward drift between runtime `AISTEERINGRULES.md` (95 lines) and committed `Releases/v4.0.3+/AISTEERINGRULES.md` (52 lines) is documented and accepted by design. Proposal-lifecycle dedup prevents curation-queue drift against prior human decisions. HWM file enables incremental mining. No automatic runtime↔release drift detector. |

---

## 5. Port Implications (for the v5+ port plan)

The port plan
(`/Users/ianmarr/projects/pai/plans/v5-0-0-plus-port.md`) sets two relevant
rules: "verify-against-v5 first" and "minimise changes to v5.0.0." Reading
the dimension contrast through that lens:

- **Capture-side hook code (RatingCapture / SatisfactionCapture, WorkCompletionLearning,
  learning-utils, learning-readback) is essentially the same baseline.**
  v5 is a strict superset on read-back (it ships `loadSynthesisPatterns()`
  the fork runtime lacks). The fork should **adopt v5's hook + readback
  code wholesale** rather than porting its own — and gets the missing
  synthesis-readback function as a side-effect. The hook-naming difference
  (fork: `RatingCapture`; v5: `SatisfactionCapture` / `SessionAnalysis`) is
  a rename + consolidation — v5's `SessionAnalysis.hook.ts` merges three
  prior hooks into one Haiku call (`hooks/README.md:154-158`); this is an
  upgrade the fork should accept, not resist.

- **`AISTEERINGRULES.md` and `loadAtStartup.files` are pure fork additions.**
  v5 has the install-template reference (`config-gen.ts:34-35`) but
  ships no actual file and ships an empty `loadAtStartup.files`. The
  v5 `LoadContext.hook.ts:84` even comments "v5.0: loadStartupFiles removed".
  v5's chosen primitive for static loading is **CLAUDE.md `@imports`**.
  The fork should choose, not silently overlay:
   - Either keep `loadAtStartup` and re-introduce `loadStartupFiles()` to
     the v5 hook code as an overlay (preserves Apply workflow targets;
     keeps forward-drift authority on runtime);
   - Or migrate `AISTEERINGRULES.md` into a CLAUDE.md `@import` line and
     drop `loadAtStartup` (aligns with v5's intentional architecture
     change; need to verify Apply workflow's "Edit AISTEERINGRULES.md"
     still works through an @-imported file — it should, since the file
     still exists at a known path).
   This is exactly the kind of "v5 has a different primitive that the fork
   should adopt instead of porting its own" case the port plan calls out.

- **The `/learn check | review | apply` curation pipeline is the fork's
  unique contribution.** v5 has no analogue beyond `LearningPatternSynthesis.ts`
  (which is a one-shot pattern-clustering CLI, not a proposal lifecycle).
  The Learning skill pack (`/Users/ianmarr/.pai/skills/Learning/`, ~28KB
  total) plus the apply targets (Algorithm spec, AISTEERINGRULES.md,
  feedback memories) is **net-new behavioural infrastructure that needs to
  port forward as overlay**. There is no v5 piece to defer to.

- **`MEMORY/WISDOM/FRAMES/` is a v5 primitive the fork doesn't currently
  use.** v5's wisdom-frame mechanism (per-domain markdown with CRYSTAL %
  confidence, hand-promoted via `WisdomFrameUpdater.ts`, surfaced by
  `loadWisdomFrames()` ≥ 85%) is structurally similar to what an
  AISTEERINGRULES rule provides but with explicit confidence accounting.
  Worth surfacing in the port: the fork could either drop AISTEERINGRULES
  entirely and re-platform onto wisdom frames, or preserve AISTEERINGRULES
  for binding rules and additionally adopt wisdom frames for soft
  observations. Implication: this is a *different primitive* tradeoff,
  not a port-forward decision.

- **Per-cwd CC auto-memory** is harness-native and survives in both worlds,
  but **v5's system prompt actively discourages writing to it** for
  behavioural rules (`PAI_SYSTEM_PROMPT.md:115-122`), while the fork's
  Apply workflow writes "DO MORE" patterns there. If the fork ports onto
  v5, the constitution-vs-loop conflict needs a deliberate resolution:
  either keep the fork's pattern (and edit the v5 system prompt to
  permit it for DO MORE), or move "DO MORE" patterns into AISTEERINGRULES
  / wisdom frames and respect v5's "infrastructure is the memory"
  doctrine. This is a doctrinal call, not an implementation detail.

- **No drift detection on either side.** Neither v5 nor the fork detects
  drift between (a) runtime AISTEERINGRULES vs committed copy, or (b)
  load-back content vs source file. The port plan's
  `verify_branch_vs_runtime` feedback memo
  (`MEMORY.md`) shows this is a recurring pain point. v5 doesn't help
  here. If the port wants to close this dimension, it would need to be
  built fresh.

---

## 6. Open Questions

1. **Did anyone ever run `LearningPatternSynthesis.ts` on v5?** It's a CLI
   tool with no cron/hook trigger in the v5 baseline. The
   `loadSynthesisPatterns()` reader will silently no-op if no SYNTHESIS dir
   exists. Worth checking whether v5 expects users to wire this themselves
   or whether a scheduler is added downstream.

2. **What's the `learning-cache.sh` writer in v5?**
   `loadSignalTrends()` reads `MEMORY/STATE/learning-cache.sh` looking for
   shell-style `today_avg='...'` assignments
   (`learning-readback.ts:254-281`), but `grep -rn learning-cache` across
   the v5 tree doesn't surface a writer. Either the writer lives outside
   the v5 distribution, is created by a separate Pulse / Cloudflare
   process, or is intended to be user-supplied. The fork has the same
   reader and the same gap — runtime has `~/.pai/MEMORY/STATE/learning-cache.sh`
   present, so something writes it; haven't traced what.

3. **What does the v5 install actually deploy for `skills/PAI/AISTEERINGRULES.md`?**
   `config-gen.ts:34-35` references this path but the v5 baseline directory
   has no such file. If the install template populates it from an internal
   default at install time, the v5 baseline is misleading. Have not
   inspected `install.sh` to confirm.

4. **Does v5's `WorkCompletion`-driven `MEMORY/LEARNING/{ALGORITHM,SYSTEM}/`
   write feed back into anything beyond `loadLearningDigest()`?** The
   digest only surfaces three entries per category. If captures accumulate
   indefinitely with no curation, the long tail is dead weight from a
   load-back perspective. The fork's curation pipeline is exactly the
   answer to this — but v5 may have a separate intent for these files
   that hasn't been surfaced in this read.

5. **Is `RatingCapture.hook.ts` (fork) a verbatim ancestor of
   `SatisfactionCapture.hook.ts` (v5), or has v5's consolidation into
   `SessionAnalysis.hook.ts` changed the rating semantics?** A line-by-line
   comparison would confirm whether the fork can drop-in adopt v5's hook
   without losing pipeline inputs.

6. **The `interceptor` skill (issue #155) and `/learn` extension to ingest
   per-cwd auto-memory (issue #147) and Learning pack resync (#145)** were
   flagged as cross-context only — the open question is whether closing
   any of those changes the answers above. Most likely #147 most directly
   intersects: if `/learn` learns to *read* per-cwd auto-memory as a
   signal source (currently it only writes there), the fork's pipeline
   would absorb the harness's natural capture surface and v5's
   "infrastructure is the memory" objection would be partially mitigated
   (memos become signals, not endpoints).
