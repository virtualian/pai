# PAI Learning System: Comprehensive Audit & Implementation Plan (v2)

**Date:** 2026-03-10
**Issues:** [#72](https://github.com/virtualian/pai/issues/72), [#73](https://github.com/virtualian/pai/issues/73)
**Sources:**
- [Discussion #884](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/884) — jlacour-git's memory audit (28 writers, 2 readers, 9 gaps)
- [Implementation Gist](https://gist.github.com/jlacour-git/b3d465e0b8e505420dd5b38958d2364e) — proposed fixes
- [Issue #850](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/850) — learning pipeline dead ends
- [Council Report](reports/2026-03-09-council-memory-audit-884.md) — 5-member council debate, 3 rounds
- [Learning Synthesis](reports/learning-synthesis-20260307.md) — cross-reinforced signals from our pipeline
- [Extraction Plan](reports/issue-51-learning-pipeline-extraction.md) — Learning skill architecture

**Supersedes:** `reports/2026-03-09-memory-audit-review-884.md` (v1)

---

## 1. Executive Summary

Three independent analyses converge on the same structural gap in PAI's learning system:

```
The pipeline today:   Behavior → Capture → Accumulate → Analyze → Display → STOP
The pipeline needed:  Behavior → Capture → Accumulate → Analyze → Surface → Review (HITL) → Apply → Changed Behavior
                          ↑                                                                              |
                          └──────────────────────────────────────────────────────────────────────────────┘
```

| Source | Key Finding |
|---|---|
| **Discussion #884** (jlacour-git) | 28 data writers, 2 retrieval points, 9 critical gaps — the memory system is write-only |
| **Issue #850** (virtualian) | Every pipeline dead-ends before the "Apply" step — reflections never captured, ratings never analyzed |
| **Council Report** (5-member debate) | 3 unanimous verdicts: WORK/ archival, synthesis readback, CorrectionMode — all with detailed specs |
| **Learning Skill** (our implementation) | Capture and analysis are working — MineRatings, Synthesize, AlgorithmUpgrade all operational. The missing piece is delivery and write-back. |
| **Learning Synthesis** (pipeline output) | Cross-reinforced signals already identified — "verify before asserting" confirmed by both reflections (4 occurrences) and ratings (26 occurrences). The data is actionable. It just doesn't reach the system. |

**Our PAI v4.0 is significantly ahead of the baseline** — 22 writers with 17 readers (5 gaps) vs. the upstream 28:2 ratio. But "better than upstream" isn't the bar. The bar is: does the system learn from its own execution and change behavior? Not yet.

---

## 2. Component-by-Component Comparison (Discussion #884)

### 2.1 ContextAssembler vs. LoadContext + learning-readback.ts

| Feature | Their Proposal | Our Implementation | Gap? |
|---------|---------------|-------------------|------|
| Session-level dedup | Tracks injected files, skips re-injection | Not implemented (relies on compaction) | **Minor** |
| Three-tier retrieval gate | Heuristic → Haiku LLM → self-exclusion | Direct file reads with confidence thresholds | No — ours is simpler and faster |
| Scoring (recency/relevance/type) | 40% recency, 30% relevance, 30% type | Implicit via file sort order + confidence cutoffs | **Minor** |
| Source diversity | Summaries, learnings, PRDs, keyword-match | Opinions, relationship notes, learnings (algo+system), wisdom frames, failure patterns, signal trends, active work | **We have MORE** |
| Token budget tracking | Explicit token accounting | ~2000 char combined limit in learning-readback.ts | **Minor** |

**Verdict:** Our LoadContext is more comprehensive. Their scoring and dedup are interesting but add LLM latency. Our sub-50ms startup constraint is a better tradeoff.

**Action:** `DEFER` — Council set a 2500-char total learning context cap. Revisit explicit budgeting if quality issues arise.

### 2.2 WorkCleanup vs. SessionCleanup

| Feature | Their Proposal | Our Implementation | Gap? |
|---------|---------------|-------------------|------|
| Archive old sessions | Moves >7-day sessions to cold storage | Marks PRD as COMPLETED, no archival | **Gap** |
| Preserve summaries | Explicitly preserves during cleanup | Summaries remain in WORK/ dir | No gap |
| Clean orphaned state | Removes orphaned state files | Cleans current-work state + kitty session | Partial |

**Current state:** 183+ WORK/ dirs, each ~2-5KB. LoadContext scans last 30. No performance issue yet.

**Action:** `IMPLEMENT` — Council Verdict #1 (see Section 5.1).

### 2.3 LoadContext Enhancement vs. LoadContext

| Feature | Their Proposal | Our Implementation |
|---------|---------------|-------------------|
| Session summaries at startup | Surfaces recent summaries | Surfaces active work (last 48h) with PRD status |
| Relationship notes | Yes | Yes (opinions + relationship notes) |
| Learning readback | Yes | Yes (4 readback functions) |
| Force-load files | Not mentioned | Yes (settings.json → loadAtStartup) |
| Project progress tracking | Not mentioned | Yes (persistent progress files) |
| Dynamic context toggles | Not mentioned | Yes (settings.json → dynamicContext) |

**Action:** `NOT APPLICABLE` — Our implementation exceeds their proposal.

### 2.4 Two-Temperature Architecture vs. Our Implicit Model

Our system has an implicit temperature model:
- **Hot:** STATE/ (runtime), recent WORK/ dirs, recent LEARNING/ files
- **Warm:** Older WORK/ dirs, older LEARNING/ files (readable but not loaded)
- **Cold:** Claude Code projects/ (30-day retention, then gone)

**Action:** `SKIP` — Council decided the implicit model works. The WORK/ archival tool addresses the concrete symptom without formalizing the architecture.

### 2.5 CorrectionMode Hook vs. Nothing

| Feature | Their Proposal | Our Implementation | Gap? |
|---------|---------------|-------------------|------|
| Cascade detection | Detects correction language | No equivalent | **Gap** |
| External grounding mandate | Forces tool use before responding | No equivalent | **Gap** |
| Reactive pattern prevention | Stops "fix the fix" spirals | AI Steering Rules (soft) | **Partial** |

**This is the most novel proposal** and the single highest-value takeaway. Our AI Steering Rules include "Never assert without verification" but it's a soft rule. Our own learning data confirms this is the #1 negative pattern (26 occurrences of "acting on wrong information," avg rating 3.42).

**Action:** `IMPLEMENT` — Council Verdict #3, with full telemetry spec (see Section 5.3).

---

## 3. Issue #850: Learning Pipeline Dead Ends

### 3.1 What #850 Found (Upstream v4.0.2)

On a fresh v4.0.2 install, two of three learning pipelines are dead ends:

1. **Algorithm reflections** — LEARN phase produces Q1-Q4 reflections but no hook captures them. `algorithm-reflections.jsonl` never written. MineReflections, AlgorithmUpgrade, and Upgrade workflows ship ready but always find 0 entries.

2. **Rating analysis** — `RatingCapture.hook.ts` writes `ratings.jsonl` correctly, but no tool analyzes accumulated data. Ratings accumulate indefinitely without a consumer.

3. **Work completion learnings** — Works end-to-end (the one working pipeline).

**Root cause:** v3.0's `StopOrchestrator.hook.ts` referenced `ReflectionCapture.ts` which never shipped. v4.0 replaced the orchestrator with independent hooks but didn't port reflection capture. For ratings, PR #735 (MineRatings) was closed without merge.

### 3.2 Daniel's v4.0.3 Response

| Claim | Actual Status |
|---|---|
| Reflection capture fixed — JSONL append added to LEARN phase | **Not shipped.** Our follow-up confirmed v4.0.3 still uses Algorithm v3.5.0, unchanged from v4.0.2. |
| Relative paths fixed in 3 workflow files | **Not shipped.** Same relative `MEMORY/` paths in v4.0.3. |
| MineRatings tracked as separate feature request | **No public tracker found.** |

### 3.3 What We've Already Built (Our Fork)

| #850 Problem | Our Solution | Status |
|---|---|---|
| Reflections never captured | Algorithm v3.7.0 LEARN phase writes JSONL directly (not via Stop hook) | **Solved** |
| No tool to analyze ratings | `Learning/Tools/MineRatings.ts` (3 bug fixes over PR #735: import path, timeout 20s→300s, conditional HWM) | **Solved** |
| MineRatings not wired into Upgrade | `Learning/Workflows/Synthesize.md` → Thread 3 delegation | **Solved** |
| Relative paths in workflows | All Learning skill paths use `~/.claude/` absolute paths | **Solved** |
| Workflows starved | Data flows: Algorithm LEARN → reflections.jsonl → Learning skill mines it | **Solved** |

### 3.4 The "Apply" Step — #850's Deepest Insight

#850's third comment maps the full feedback loop and identifies where every pipeline stops:

| Signal Source | Capture | Accumulate | Analyze | Apply |
|---|---|---|---|---|
| Ratings | RatingCapture hook | ratings.jsonl (757+ entries) | MineRatings.ts | **Nothing** |
| Reflections | Algorithm LEARN phase | algorithm-reflections.jsonl (23+ entries) | MineReflections workflow | **Nothing** |
| Work completions | WorkCompletionLearning hook | work-learnings.jsonl | **Nothing** | **Nothing** |
| /PAIUpgrade report | Displayed to terminal | **Not persisted** | N/A (it IS the analysis) | **Nothing** |

> "The stated vision is 'hill-climbing on its own hill-climbing capability' but the hill-climbing step — modifying the system based on analysis — doesn't exist."

This is the most important finding across all three sources.

---

## 4. Producer-Consumer Gap Analysis (Our System)

### 4.1 Full Inventory

| Writer | Writes To | Has Reader? |
|--------|-----------|-------------|
| Algorithm (AI) | WORK/PRD.md | Yes — LoadContext, PRDSync |
| PRDSync.hook.ts | STATE/work.json | Yes — AlgorithmTab, LoadContext |
| RatingCapture.hook.ts | LEARNING/SIGNALS/ratings.jsonl | Yes — learning-cache.sh → LoadContext |
| RatingCapture.hook.ts | LEARNING/ALGORITHM/ or SYSTEM/ | Yes — learning-readback.ts → LoadContext |
| RatingCapture.hook.ts (low) | LEARNING/FAILURES/ | Yes — learning-readback.ts → LoadContext |
| WorkCompletionLearning.hook.ts | LEARNING/ | Yes — learning-readback.ts → LoadContext |
| SessionCleanup.hook.ts | WORK/PRD.md (COMPLETED) | Yes — LoadContext filters these |
| RelationshipMemory.hook.ts | MEMORY/RELATIONSHIP/ | Yes — LoadContext |
| UpdateCounts.hook.ts | settings.json counts | Yes — startup banner |
| SessionAutoName.hook.ts | STATE/session-names.json | Yes — LoadContext |
| LastResponseCache.hook.ts | STATE/last-response.txt | Yes — RatingCapture |
| SecurityValidator.hook.ts | SECURITY/security-events.jsonl | **Partial** — no regular reader |
| IntegrityCheck.hook.ts | STATE/integrity/ | **Partial** — reactive only |
| DocIntegrity.hook.ts | (modifies docs) | N/A |
| KittyEnvPersist.hook.ts | STATE/kitty-sessions/ | Yes — VoiceCompletion |
| UpdateTabTitle.hook.ts | (terminal escape codes) | N/A |
| ResponseTabReset.hook.ts | (terminal escape codes) | N/A |
| VoiceCompletion.hook.ts | (HTTP to voice server) | N/A |
| SessionHarvester.ts (tool) | LEARNING/ | Yes — learning-readback.ts |
| LearningPatternSynthesis.ts (tool) | LEARNING/SYNTHESIS/ | **No regular reader** |
| Algorithm reflections (AI) | LEARNING/REFLECTIONS/ | **Manual only** (Learning skill) |
| Event emitters (multiple) | STATE/events.jsonl | **No regular reader** |

### 4.2 Identified Gaps

| # | Written Data | Gap | Severity | Resolution |
|---|---|---|---|---|
| 1 | LEARNING/SYNTHESIS/ weekly patterns | Not loaded into session context | Medium | `loadLatestSynthesis()` — Council Verdict #2 |
| 2 | LEARNING/REFLECTIONS/ | Manual analysis only (Learning skill) | Medium | `loadLatestSynthesis()` reads synthesis, not raw |
| 3 | SECURITY/security-events.jsonl | No periodic reader | Low | Monitor; dashboard if needed |
| 4 | STATE/events.jsonl | No consumer beyond manual tailing | Low | Future observability |
| 5 | STATE/integrity/ | Only read reactively | Low | Acceptable pattern |

**Our ratio: 22 writers, 17 with readers, 5 gaps.** Gaps #1 and #2 are addressed by the implementation plan below.

---

## 5. Council Verdicts (Unanimous 5/5)

A 5-member council (Status Quo Defender, Advocate, Architect, Researcher, PAI Expert) debated in 3 rounds. All proposals reached unanimous approval with design refinements.

### 5.1 Verdict 1: WORK/ Archival Tool — IMPLEMENT FIRST

| Aspect | Consensus |
|--------|-----------|
| Mechanism | PAI tool (`WorkArchival.ts`), not cron — consistent with SessionHarvester, LearningPatternSynthesis |
| Threshold | Archive COMPLETED WORK/ dirs older than 90 days |
| Destination | `WORK/ARCHIVE/YYYY-MM/` (compressed) |
| Routing | Must update LoadContext scanning index atomically |
| Current state | 183+ WORK/ dirs, LoadContext scans 30 per startup |
| Invocation | Algorithm-invocable (not manual-only) |
| Risk | Near-zero — read-only completed data, reversible |

### 5.2 Verdict 2: Synthesis Readback — IMPLEMENT SECOND

| Aspect | Consensus |
|--------|-----------|
| Architecture | Scheduled synthesis job (LearningPatternSynthesis.ts exists) → one readback function |
| Readback | Single `loadLatestSynthesis()` function in `learning-readback.ts` |
| Source | Latest `LEARNING/SYNTHESIS/` weekly-patterns file — NOT raw reflections |
| Budget | Brevity enforced at write-time (256-token cap per synthesis entry) |
| Count | One recent synthesis |
| Context cap | Total learning readback must stay under 2500 chars |
| Risk | Low — read-only addition, no write-path changes |

**Key insight:** Raw reflections are noise. The synthesis job is the materialized view. Don't read the log — read the summary.

**Why this matters now:** The learning-synthesis report from 2026-03-07 identified "acting on wrong information" as the #1 cross-reinforced signal (26 rating occurrences + 4 reflection occurrences). This already exists in AI Steering Rules but isn't reinforced. `loadLatestSynthesis()` would surface it every session.

### 5.3 Verdict 3: CorrectionMode via RatingCapture Extension — IMPLEMENT THIRD

| Aspect | Consensus |
|--------|-----------|
| Architecture | Extend existing RatingCapture hook — NOT a new hook |
| Detection | Reuse correction patterns already at RatingCapture lines 192-195 |
| Threshold | High confidence (>=0.8) before emitting system-reminder |
| Scope | Explicit corrections only ("no, I meant...", "that's wrong") — NOT refinements |
| Output | Emit `<system-reminder>` on stdout forcing Read/Grep before Edit/Write |
| Reminder size | <200 characters |
| Kill-switch | Configurable disable in settings.json + auto-disable on negative metrics |
| Telemetry | **MANDATORY** — full spec below |

**Key insight:** Guardian's "category error" concern (sentiment patterns repurposed for behavioral directives) was resolved by the confidence threshold. The detection surface already exists — the question was never "can we detect corrections?" but "should detection trigger behavioral change?" The 0.8 threshold makes this safe.

#### CorrectionMode Telemetry Spec

**Storage:** Dedicated `MEMORY/LEARNING/SIGNALS/corrections.jsonl`

```jsonl
{
  "timestamp": "ISO-8601",
  "session_id": "uuid",
  "correction_id": "corr_YYYYMMDD_HHMMSS",
  "phase": "triggered|verified|rated",
  "confidence": 0.87,
  "suppressed": false,
  "prompt_preview": "No, I said rename not delete",
  "pattern_matched": "negation_correction|redirect|behavioral|omission",
  "verification": {
    "performed": true,
    "tools_used": ["Read", "Grep"],
    "tools_before_edit": true,
    "elapsed_ms": 1400
  },
  "outcome": {
    "rating": 7,
    "delta_from_trigger": "+4",
    "turns_to_resolution": 2
  }
}
```

**3-phase correlation:** One `correction_id` generates up to 3 JSONL lines:
1. `phase: "triggered"` — on detection (confidence, prompt_preview, suppressed)
2. `phase: "verified"` — after verification tools observed (verification block)
3. `phase: "rated"` — when next rating captured (outcome block)

**Metrics:**

| Metric | Type | Target |
|--------|------|--------|
| Precision | Primary | >= 70% |
| Verification compliance | Leading | >= 80% |
| Rating delta | Outcome | > 0 |
| Turns to resolution | Outcome | Decreasing trend |
| False positive rate | Safety | < 30% |
| Correction rate | Volume | < 25% of prompts |
| Suppressed events | Counterfactual | Logged always |

**Auto-Kill-Switch:** Before each system-reminder emission:
1. Read last 20 `phase: "rated"` entries
2. If rolling avg `delta_from_trigger` <= 0 → suppress, log `killswitch_delta`
3. If false positive rate > 30% over 7-day window → auto-disable
4. If 3 consecutive false positives → immediate auto-disable

**State file:** `MEMORY/STATE/correction-mode.json`

```json
{
  "enabled": true,
  "review_period_days": 7,
  "verbose": false,
  "auto_disabled_at": null,
  "auto_disabled_reason": null,
  "lifetime_corrections": 0,
  "lifetime_false_positives": 0,
  "review_started_at": "ISO-8601",
  "next_review_at": "ISO-8601"
}
```

**Review cadence:** 7 days (default) → 14 days (stable) → 30 days (steady state). Auto-extends if <30 events. Review triggers inline at each correction detection.

**Verbose mode:** When `verbose: true`, surfaces telemetry at 3 contextual moments:
- After correction resolves: `CorrectionMode: confidence 0.87 → verified (Read×2, Grep×1) → rating +4 delta`
- At Algorithm VERIFY phase: session correction summary
- At session start: period overview with kill-switch health

**Counterfactual measurement (Ava's framework):** Track ALL detections — fired (>=0.8) and suppressed (0.6-0.79 or kill-switch active). Compare `turns_to_resolution` between groups. Implicit control group without A/B periods.

**Periodic review report:** Auto-generated at each review boundary to `LEARNING/SIGNALS/correction-reviews/YYYY-MM-DD.md`. Decision framework: 2 of 3 core metrics failing = redesign. All 3 = kill.

---

## 6. What We've Already Built (Learning Skill)

The Learning skill ([issue #51](https://github.com/virtualian/pai/issues/51)) was extracted from PAIUpgrade into a standalone skill with clean ownership boundaries:

```
Capture Layer (hooks)              Analysis Layer (Learning skill)
  RatingCapture.hook.ts              MineReflections workflow
  WorkCompletionLearning.hook.ts     MineRatings workflow + CLI tool
  LoadContext.hook.ts                AlgorithmUpgrade workflow
  learning-readback.ts               Synthesize workflow
           |                                  |
           v                                  v
     MEMORY/LEARNING/                  Actionable patterns,
     (ratings.jsonl,                   Algorithm upgrade proposals,
      reflections.jsonl)               STOP/DO MORE rules
```

### 6.1 Components

| Component | Purpose | Status |
|---|---|---|
| `Learning/Tools/MineRatings.ts` | Behavioral pattern analysis from ratings (Sonnet inference, 300s timeout, HWM tracking) | Working |
| `Learning/Workflows/MineReflections.md` | Mine algorithm reflections — Q1/Q2/Q3 clustering, weighted by sentiment/budget/criteria | Working |
| `Learning/Workflows/MineRatings.md` | Workflow wrapper for MineRatings CLI tool | Working |
| `Learning/Workflows/Synthesize.md` | Parallel mining (reflections + ratings), cross-referencing, combined Internal Signals output | Working |
| `Learning/Workflows/AlgorithmUpgrade.md` | Maps reflection themes to Algorithm spec sections, proposes concrete version-bumped patches | Working |

### 6.2 Evidence the Pipeline Works

The 2026-03-07 synthesis report analyzed 24 reflections and 760 ratings across 6 weeks:

**Top cross-reinforced signals:**

| Signal | Reflection Evidence | Rating Evidence | Combined Confidence |
|---|---|---|---|
| **Verify before asserting** | "Read existing tooling before improvising" (4 occurrences) | STOP "acting on wrong information" (26 occurrences, avg 3.42) | **STRONGEST** |
| **Thoroughness wins** | "Direct writing beats delegation when source is in context" | DO MORE "comprehensive research with synthesis" (avg 8.82) | HIGH |
| **Don't repeat failures** | "Unnecessary sequential operations" (7 occurrences) | STOP "repeated failed attempts without changing approach" (rating 2) | HIGH |

**Data quality notes:**
- 58% of reflection entries have null Q1/Q2/Q3 (auto-hook captures only)
- 86% of ratings are implicit 5/10 (RatingCapture default) — non-5 entries are the true signal
- Early reflections have uniform `implied_sentiment: 6` (hook default, not genuine estimate)

### 6.3 Bugs Found and Fixed (vs. Upstream PR #735)

| Bug | Fix |
|---|---|
| Import path wrong (3 levels instead of 4) | Corrected to `../../../../PAI/Tools/Inference` |
| Inference timeout 20s (too short for 757 entries) | Increased to 300s |
| HWM updates on inference failure (data lost to incremental mode) | Gated on successful completion |

---

## 7. Alignment Matrix — All Three Sources

### 7.1 Where All Three Agree

| Finding | #884 | #850 | Council | Learning Skill |
|---|---|---|---|---|
| Learning system is write-heavy, read-starved | Core thesis | Core thesis | Validated | Confirmed by 5 gaps |
| Reflections have no automatic read path | Proposed fix | Confirmed broken | Verdict #2 | Manual mining works |
| The "Apply" step is missing everywhere | Implicit | Explicit (3rd comment) | Partial (readback only) | AlgorithmUpgrade proposes but doesn't apply |

### 7.2 What Each Source Uniquely Contributes

| Source | Unique Contribution |
|---|---|
| **Discussion #884** | CorrectionMode concept, two-temperature architecture, scoring model |
| **Issue #850** | Capture-side regression history, the "Apply" step diagnosis, MineRatings tool concept, upstream accountability |
| **Council Report** | CorrectionMode full telemetry spec, kill-switch, counterfactual measurement, review cadence |
| **Learning Skill** | Working analysis pipeline, cross-reinforced signals, AlgorithmUpgrade section targeting, Synthesize workflow |
| **Learning Synthesis** | Concrete evidence — top behavioral patterns with frequencies and ratings, data quality assessment |

### 7.3 Where They Diverge

| Topic | #850's Position | Council's Position | Resolution |
|---|---|---|---|
| **How to capture reflections** | Stop hook (ReflectionCapture.hook.ts) | N/A (assumed working) | Our approach: Algorithm LEARN phase writes directly (zero hook overhead) |
| **How to close the read gap** | Read raw reflections | Read synthesis (materialized view) | Council's approach — raw reflections are noise |
| **How to close the write-back gap** | Auto-write to AISTEERINGRULES.md | Not fully designed | Needs HITL design (Section 8) |
| **CorrectionMode** | Not discussed | Full spec with telemetry | Net-new from Discussion #884 |

---

## 8. The Remaining Gap: HITL Write-Back

This is where all three sources point but none fully solves.

### 8.1 Three Approaches to the Apply Step

| Approach | Writes To | Automation | Risk |
|---|---|---|---|
| **#850's proposal** | `AISTEERINGRULES.md` | Fully automated | High — auto-editing behavioral config |
| **Council Verdict #2** | Session context via `loadLatestSynthesis()` | Semi-automated (read-only) | Low — surfacing, not editing |
| **AlgorithmUpgrade workflow** | Algorithm spec (proposes diffs) | Manual (user applies) | Lowest — human-in-the-loop |

### 8.2 Proposed Design (Needs Architecture)

```
Learning Skill
  Synthesize → Cross-reinforced signals
  AlgorithmUpgrade → Section-targeted diffs
                          ↓
                  Review Queue (persisted)
                          ↓
              HITL Review Interface
              ┌─────────────────────┐
              │  Approve  │ Reject  │
              │  Edit     │ Defer   │
              └─────────────────────┘
                          ↓
              Write to target:
              - AISTEERINGRULES.md (STOP/DO MORE)
              - Algorithm spec (version bump)
              - LEARNING/WISDOM/ (new frames)
```

**Open design questions:**
1. What's the review surface? A report file? An interactive prompt? A dedicated workflow?
2. How granular is approval? Per-recommendation? Per-category? Batch?
3. Should high-confidence patterns (5+ occurrences, cross-reinforced) auto-apply?
4. How does the system track applied vs. pending recommendations?
5. What prevents the system from adding conflicting or redundant rules over time?

---

## 9. Rejected Proposals

| Proposal | Source | Decision | Reason |
|---|---|---|---|
| Two-temperature formalization | #884 | SKIP | Implicit model works; WORK/ archival addresses the symptom |
| Context scoring model (40/30/30) | #884 | SKIP | Adds Haiku LLM latency to startup; file-sort approach is faster |
| Session dedup tracking | #884 | SKIP | Compaction handles adequately |
| New ContextAssembler hook | #884 | SKIP | Our LoadContext exceeds their proposal |
| Explicit token budgeting | #884 | DEFER | Partially addressed by 2500-char cap |
| ReflectionCapture Stop hook | #850 | SKIP | Algorithm LEARN phase writes directly — zero hook overhead |
| Automated write-back (no HITL) | #850 | DEFER | Needs careful design — auto-editing behavioral config is high-risk |

---

## 10. Implementation Plan

### Priority Order (Council-Approved)

```
┌─────────────────────────────────────────────────────────────────────┐
│  #1  WORK/ Archival Tool                                            │
│  Risk: LOW  │  Effort: SMALL  │  Impact: IMMEDIATE                  │
│  → WorkArchival.ts, 90-day threshold, WORK/ARCHIVE/YYYY-MM/        │
├─────────────────────────────────────────────────────────────────────┤
│  #2  Synthesis Readback                                             │
│  Risk: LOW  │  Effort: TINY   │  Impact: CLOSES READ LOOP          │
│  → loadLatestSynthesis() in learning-readback.ts                    │
├─────────────────────────────────────────────────────────────────────┤
│  #3  CorrectionMode via RatingCapture                               │
│  Risk: MED  │  Effort: SMALL  │  Impact: HIGHEST VALUE              │
│  → Extend RatingCapture, 0.8 threshold, telemetry, kill-switch      │
├─────────────────────────────────────────────────────────────────────┤
│  #4  HITL Review Interface                                          │
│  Risk: MED  │  Effort: MEDIUM │  Impact: CLOSES WRITE-BACK LOOP    │
│  → Design needed — review queue, approval surface, write targets     │
├─────────────────────────────────────────────────────────────────────┤
│  #5  Scheduled Synthesis                                            │
│  Risk: LOW  │  Effort: SMALL  │  Impact: AUTOMATION                 │
│  → After #2 and #4 are proven                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Dependencies

```
#1 (Archival) ─── independent, implement anytime
#2 (Readback) ─── independent, implement anytime
#3 (CorrectionMode) ─── independent, but benefits from #2 (synthesis provides baseline data)
#4 (HITL Review) ─── depends on #2 (needs synthesis readback working) + Learning skill (analysis pipeline)
#5 (Scheduled Synthesis) ─── depends on #2 + #4
```

### What Already Exists (No Build Needed)

| Component | Status |
|---|---|
| Algorithm v3.7.0 LEARN phase → reflections.jsonl | Deployed |
| RatingCapture.hook.ts → ratings.jsonl | Deployed |
| Learning/Tools/MineRatings.ts | Built, tested |
| Learning/Workflows/MineReflections.md | Built, tested |
| Learning/Workflows/Synthesize.md | Built, tested |
| Learning/Workflows/AlgorithmUpgrade.md | Built, tested |
| LoadContext.hook.ts + learning-readback.ts | Deployed (4 readback functions) |
| learning-cache.sh | Deployed |

---

## 11. Tracking

| Issue | Scope |
|---|---|
| [#72](https://github.com/virtualian/pai/issues/72) | Original Discussion #884 review |
| [#73](https://github.com/virtualian/pai/issues/73) | Continuous HITL learning cycle — aggregate implementation |
| [#50](https://github.com/virtualian/pai/issues/50) | Close the learning loop |
| [#51](https://github.com/virtualian/pai/issues/51) | Learning pipeline extraction (completed) |
| [#850](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/850) | Upstream: learning pipeline dead ends |
| [#884](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/884) | Upstream: memory audit discussion |
