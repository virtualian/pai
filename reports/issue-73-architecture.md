# Issue #73 — Continuous HITL Learning Cycle: Architecture & Design

**Issue:** [#73](https://github.com/virtualian/pai/issues/73)
**Branch:** `73-continuous-hitl-learning-cycle`
**Date:** 2026-03-10
**Status:** 3 of 5 work items complete

---

## 1. Problem Statement

PAI's learning system captures behavioral data at scale — 767+ ratings, 23+ algorithm reflections, 8,400+ learning files across 5 hooks — but the feedback loop is open. Data flows in one direction:

```
Behavior → Capture → Accumulate → Analyze → STOP
```

Three independent analyses converged on this diagnosis:

| Source | Finding |
|--------|---------|
| [Issue #850](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/850) (upstream) | "Every pipeline dead-ends before the Apply step" |
| [Council Report](2026-03-09-council-memory-audit-884.md) (Discussion #884) | 3 unanimous verdicts: WORK/ archival, synthesis readback, CorrectionMode |
| Learning Skill implementation audit | MineRatings, Synthesize, AlgorithmUpgrade built and working — output displayed and discarded |

The system captures corrections, frustration, praise, and satisfaction — but never acts on them. A correction goes undetected. A praised behavior is never reinforced. Synthesis reports are generated and forgotten.

### The Open Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT STATE                                                      │
│                                                                     │
│  Behavior → Capture → Accumulate → Analyze → (displayed) → STOP    │
│      ↑                                                              │
│      └── No connection back ──────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### The Target State

```
┌─────────────────────────────────────────────────────────────────────┐
│  TARGET STATE                                                       │
│                                                                     │
│  Behavior → Capture → Accumulate → Analyze → Surface → Review      │
│      ↑                                          (auto)    (HITL)    │
│      │                                                     │        │
│      └── Changed Behavior ← Apply ← Approve ──────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

The gap is **delivery** — getting analysis results into session context automatically, and enabling human-approved write-back to behavioral config.

---

## 2. Solution Rationale

### Why not a separate learning service?

PAI runs as Claude Code hooks — lightweight TypeScript scripts triggered by session events. Adding a separate service (daemon, database, API) would violate KISS and create deployment complexity. The solution must work within the existing hook architecture.

### Why extend RatingCapture instead of adding hooks?

The council debate ([full report](2026-03-09-council-memory-audit-884.md)) evaluated adding a new `CorrectionDetection.hook.ts` vs extending the existing `RatingCapture.hook.ts`. Vex's argument won 4/5: RatingCapture already parses user prompts, has access to sentiment patterns, and runs on every `UserPromptSubmit` event. Adding correction detection as a fast-path (~5ms regex) before the existing sentiment analysis (~1s inference) adds zero new hooks and zero new event subscriptions.

### Why unify corrections and reinforcements?

Rather than building `CorrectionMode` and `ReinforcementMode` as separate systems, we unified them into a single behavioral feedback system. Rationale:

- Corrections and reinforcements are the same signal axis (negative/positive poles)
- Shared JSONL format, state management, and readback function eliminates code duplication
- A single `loadBehavioralTrends()` function surfaces both "avoid this" and "do more of this" in one context line
- CorrectionMode had zero production data at unification time — clean rename, no migration cost

### Why regex-first classification?

PAI's structured output format (NATIVE/ALGORITHM modes) contains markers like `✅ VERIFY`, `🔄 ITERATION`, and keywords like "verified", "deployed", "surgical". Regex classification against these markers runs in ~5ms with 0.75-0.90 confidence. Inference fallback (Haiku, ~1s) was designed but deferred — the regex miss rate needs measurement before investing in inference overhead. Unclassified behaviors get confidence 0.5, below the 0.7 capture threshold, and are silently skipped.

### Why session-start readback instead of real-time intervention?

CorrectionMode emits a real-time `<system-reminder>` because corrections require immediate behavior change ("stop and verify before editing"). Reinforcements don't need real-time intervention — "keep doing what you're doing" is low-value mid-session. Instead, reinforcement trends are surfaced at session start via `loadBehavioralTrends()`, where they inform the model's behavioral priors for the entire session.

---

## 3. System Architecture

### Data Flow

```
                    UserPromptSubmit (hook trigger)
                              │
                              ▼
                    ┌─────────────────────┐
                    │  RatingCapture.hook  │
                    │                     │
                    │  1. CorrectionMode  │───▶ system-reminder (real-time)
                    │     (fast-path,5ms) │
                    │                     │
                    │  2. Rating Capture  │
                    │     (explicit/      │
                    │      praise/        │
                    │      sentiment)     │
                    │                     │
                    │  3. Reinforcement   │
                    │     Mode (post-     │
                    │     write, async)   │
                    └────────┬────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
          ┌──────────────┐  ┌──────────────────┐
          │ ratings.jsonl │  │ behavioral-      │
          │  (767+ entries)│  │ signals.jsonl    │
          └──────┬───────┘  └────────┬─────────┘
                 │                   │
                 │          ┌────────┴─────────┐
                 │          ▼                   ▼
                 │   corrections          reinforcements
                 │   (signal_type:        (signal_type:
                 │    "correction")        "reinforcement")
                 │
       ┌─────────┴──────────┐
       ▼                    ▼
  MineRatings          Synthesize        ◄── Manual invocation
  (analysis)           (weekly)               (Learning skill)
       │                    │
       ▼                    ▼
  LEARNING/            LEARNING/
  ALGORITHM/           SYNTHESIS/
  SYSTEM/              (weekly reports)
       │                    │
       └────────┬───────────┘
                ▼
       ┌──────────────────────┐
       │ learning-readback.ts │    ◄── SessionStart (LoadContext)
       │                      │
       │ • loadSignalTrends() │───▶ Performance: Today 5.1/10, Week...
       │ • loadBehavioralTrends()│─▶ Behavioral Feedback: Corrections...
       │ • loadWisdomFrames() │───▶ Wisdom Frames (high confidence)
       │ • loadLatestSynthesis()│──▶ Latest Synthesis: Period, Issues...
       │ • loadLearningDigest()│──▶ Recent Learning Signals
       │ • loadFailurePatterns()│─▶ Recent Failure Patterns
       └──────────────────────┘
                │
                ▼
       <system-reminder> injected at session start
       (~1620 chars within 2500 char budget)
```

### State Files

| File | Location | Purpose |
|------|----------|---------|
| `ratings.jsonl` | `MEMORY/LEARNING/SIGNALS/` | All ratings (explicit + implicit sentiment) |
| `behavioral-signals.jsonl` | `MEMORY/LEARNING/SIGNALS/` | Correction + reinforcement signals |
| `behavioral-feedback.json` | `MEMORY/STATE/` | Unified state (enabled flags, lifetime counts, behavior frequencies) |
| `learning-cache.sh` | `MEMORY/STATE/` | Pre-computed performance metrics (shell vars) |

### Hook Execution Order

```
SessionStart:
  LoadContext.hook.ts → loadBehavioralTrends() → system-reminder

UserPromptSubmit:
  RatingCapture.hook.ts:
    1. detectCorrection() [sync, ~5ms]
       → writeBehavioralSignal(signal_type: "correction")
       → emit system-reminder
    2. parseExplicitRating() [sync, <1ms]
       → writeRating() → captureReinforcement()
    3. analyzeSentiment() [async, ~1s]
       → writeRating() → captureReinforcement()

Stop:
  LastResponseCache.hook.ts → cache response for next rating
```

---

## 4. Work Items

### Item 1: Synthesis Readback — `loadLatestSynthesis()`

**Status:** ✅ Implemented ([commit 8e6cafe](https://github.com/virtualian/pai/commit/8e6cafe))

Reads from `LEARNING/SYNTHESIS/` weekly reports and injects the most recent synthesis at session start. 256-token cap. Surfaces the top issues and recommendations so the model sees its own behavioral patterns every session.

**Files:** `learning-readback.ts` (lines 229-299), `LoadContext.hook.ts` (line 491)

### Item 2: CorrectionMode — Fast-Path Detection

**Status:** ✅ Implemented ([commit 8e6cafe](https://github.com/virtualian/pai/commit/8e6cafe))

Detects explicit corrections in user prompts ("No, I meant...", "That's wrong", "Don't do that") and emits a `<system-reminder>` forcing verification before edits. Runs as a synchronous fast-path (~5ms) before sentiment analysis.

- 7 high-precision regex patterns with confidence thresholds
- 5 refinement exclusion patterns (prevents false positives on "Actually, let's try...")
- Kill-switch: auto-disables if corrections aren't helping (rolling average delta ≤ 0, or 3 consecutive false positives)
- Full telemetry to `behavioral-signals.jsonl`

**Files:** `RatingCapture.hook.ts` (lines 76-483)

**Design spec:** [Council report](2026-03-09-council-memory-audit-884.md) — Verdict #3

### Item 3: ReinforcementMode — Positive Signal Capture

**Status:** ✅ Implemented ([commit 6c0921b](https://github.com/virtualian/pai/commit/6c0921b))

Captures high-rated behaviors (rating ≥ 8) and classifies what the AI did well using regex-based behavior markers. Unified with CorrectionMode into a single behavioral feedback system.

- 7 behavior classification patterns (thorough-verification, surgical-precision, evidence-based, etc.)
- Over-reinforcement guard: saturation cap (20 per behavior type), session cap (3 per invocation), confidence floor (0.7)
- Readback via `loadBehavioralTrends()` at session start
- No real-time system-reminder (readback only)

**Files:** `RatingCapture.hook.ts` (lines 184-311), `learning-readback.ts` (lines 306-381)

**Design spec:** [reinforcement-mode-design.md](reinforcement-mode-design.md)

### Item 4: WORK/ Archival Tool

**Status:** ❌ Not started

Archive COMPLETED WORK/ directories older than 90 days to `WORK/ARCHIVE/YYYY-MM/`. Currently 183+ accumulated directories.

**Rationale:** Council Verdict #1 — lowest risk, smallest effort, immediate filesystem hygiene impact.

**Design needed:** Simple tool spec — input (age threshold), output (moved dirs), safety (only COMPLETED status, reversible).

### Item 5: HITL Review Interface — The Apply Step

**Status:** 🔬 Research complete, design pending

The capstone component that closes the loop. Learning analysis produces actionable recommendations → recommendations are persisted to a review queue → principal reviews and approves/rejects → approved changes are written to behavioral config.

**Research:** [HITL observability/control UI research](2026-03-10-pai-hitl-observability-control-UI-research.md) — evaluated 25+ frameworks. Conclusion: Python Textual + SQLite (WAL mode) is the optimal stack for a terminal-based dashboard with HITL approval workflows.

**Design questions (open):**
- What's the review surface? Terminal TUI? Interactive CLI workflow? Report file with approve commands?
- How granular is approval? Per-recommendation? Per-category? Batch?
- Should high-confidence patterns (5+ observations, cross-reinforced) auto-apply?
- What targets receive approved changes? (`AISTEERINGRULES.md`, Algorithm spec, Wisdom Frames)

### Item 6 (Deferred): Scheduled Synthesis

**Status:** ❌ Blocked on Items 4 and 5

Currently all analysis is manual invocation only. Once readback and HITL are in place, schedule periodic synthesis runs that auto-generate review reports and feed the HITL queue.

---

## 5. Decision Log

| Decision | Rationale | Date | Source |
|----------|-----------|------|--------|
| Extend RatingCapture instead of new hook | Zero added event subscriptions, reuses existing prompt parsing | 2026-03-09 | Council Round 2 (Vex's design) |
| Unify corrections + reinforcements | Same signal axis, shared format/state/readback, zero migration cost | 2026-03-10 | [reinforcement-mode-design.md](reinforcement-mode-design.md) |
| Regex-only classification (defer inference) | ~5ms vs ~1s, measure miss rate before investing | 2026-03-10 | Implementation decision |
| Session-start readback (not real-time) for reinforcements | "Keep doing that" is low-value mid-session | 2026-03-10 | [reinforcement-mode-design.md](reinforcement-mode-design.md) |
| 0.7 confidence floor for reinforcement capture | Higher than general sentiment (0.5) to avoid false reinforcement | 2026-03-10 | Design spec |
| Module-level session counter (not DB) | Hook runs as separate process per event — natural reset | 2026-03-10 | Implementation decision |
| Full file read in readback (defer tail-read) | Zero entries in signals file — premature optimization | 2026-03-10 | /simplify review |
| Textual + SQLite for HITL UI (research conclusion) | Native Python, zero IPC, SSH-compatible, proven at scale | 2026-03-10 | [HITL research](2026-03-10-pai-hitl-observability-control-UI-research.md) |

---

## 6. Context Budget

Learning context is injected at session start by `LoadContext.hook.ts`. Total budget: 2500 chars.

| Component | Chars | Source |
|-----------|-------|--------|
| Performance Signals | ~120 | `loadSignalTrends()` |
| **Behavioral Feedback** | ~350 | `loadBehavioralTrends()` |
| Wisdom Frames | ~200 | `loadWisdomFrames()` |
| Latest Synthesis | ~400 | `loadLatestSynthesis()` |
| Learning Digest | ~300 | `loadLearningDigest()` |
| Failure Patterns | ~250 | `loadFailurePatterns()` |
| **Total** | **~1620** | Within 2500 budget |

---

## 7. Remaining Work

### Immediate (no design needed)

- **WORK/ Archival** — simple tool, council-approved spec exists

### Needs Design

- **HITL Review Interface** — research is done, needs a concrete design doc specifying:
  - Review queue format and storage
  - Approval workflow (TUI vs CLI vs file-based)
  - Write-back targets and safety constraints
  - Auto-apply thresholds for high-confidence patterns

### Deferred

- **Scheduled Synthesis** — blocked on HITL
- **Inference fallback** for behavior classification — measure regex miss rate first
- **Tail-read optimization** in `loadBehavioralTrends()` — when signals file grows
- **Correction verified/rated phases** — needs PostToolUse observer
- **Correction ↔ reinforcement correlation** — "corrected then praised" pattern detection

---

## 8. References

| Document | Type |
|----------|------|
| [Issue #73](https://github.com/virtualian/pai/issues/73) | Feature spec |
| [reinforcement-mode-design.md](reinforcement-mode-design.md) | Component design (implemented) |
| [2026-03-09-council-memory-audit-884.md](2026-03-09-council-memory-audit-884.md) | Council debate + CorrectionMode spec |
| [2026-03-09-memory-audit-review-884.md](2026-03-09-memory-audit-review-884.md) | Component audit |
| [2026-03-10-memory-audit-review-v2.md](2026-03-10-memory-audit-review-v2.md) | V2 audit |
| [2026-03-10-pai-hitl-observability-control-UI-research.md](2026-03-10-pai-hitl-observability-control-UI-research.md) | HITL UI research |
| [Issue #850](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/850) | Upstream diagnosis |
| [Discussion #884](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/884) | Upstream memory audit |
