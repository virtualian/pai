# Council Report: Memory Audit Review — Discussion #884

**Date:** 2026-03-09
**Issue:** [#72](https://github.com/virtualian/pai/issues/72)
**Source Report:** `reports/2026-03-09-memory-audit-review-884.md`
**Council:** 5 members, 3 rounds

---

## Council Members

| Role | Name | Perspective |
|------|------|-------------|
| 🛡️ Status Quo Defender | Guardian | System stability, avoid unnecessary complexity |
| 📢 Advocate | Champion | Champions proposed improvements from Discussion #884 |
| 🏛️ Architect | Serena Blackwood | Structural design, coupling, architectural implications |
| 🔍 Researcher | Ava Chen | External evidence, prior art, research patterns |
| ⚡ PAI Expert | Vex | Deep PAI v4.0 implementation knowledge |

---

## Debate Summary

### Round 1 — Initial Positions

| Member | CorrectionMode | Reflections Readback | WORK/ Archival |
|--------|---------------|---------------------|----------------|
| Guardian | REJECT — brittle pattern-matching, false positive risk | REJECT — speculative overhead | REJECT — cron job suffices |
| Champion | ACCEPT — architecture beats discipline | ACCEPT — write-only infra indefensible | ACCEPT — hygiene compounds |
| Serena | ACCEPT with thresholds | REJECT as scoped (context budget) | ACCEPT unconditionally |
| Ava | ACCEPT — circuit breaker pattern | ACCEPT with materialized views | ACCEPT — hot/cold tiering |
| Vex | ACCEPT via RatingCapture extension | REJECT raw; ACCEPT scheduled synthesis | ACCEPT — 183 dirs, pure win |

### Round 2 — Key Shifts

- **Vex's design won the room:** Extend RatingCapture (already detects corrections at lines 192-195) instead of adding a new hook. Zero added latency. 4/5 endorsed immediately.
- **Guardian conceded synthesis readback** when scoped to one function with hard cap — but held firm against CorrectionMode.
- **Champion conceded** the hook architecture point to Vex.
- **Ava refined** CorrectionMode threshold: trigger only on explicit corrections ("no, I said X"), not refinements ("actually, let's try Y").
- **Serena** endorsed Vex's design, proposed brevity enforcement at write-time not read-time.

### Round 3 — Final Convergence

| Member | CorrectionMode | Reflections Readback | WORK/ Archival |
|--------|---------------|---------------------|----------------|
| Guardian | ACCEPT (conceded) | ACCEPT (synthesis only) | ACCEPT |
| Champion | ACCEPT | ACCEPT | ACCEPT |
| Serena | ACCEPT | ACCEPT | ACCEPT |
| Ava | ACCEPT | ACCEPT (concedes to 1 synthesis) | ACCEPT |
| Vex | ACCEPT | ACCEPT | ACCEPT |

**Final vote: 5/5 unanimous on all three proposals** (with design refinements from debate).

---

## Council Verdicts

### Verdict 1: WORK/ Archival Tool

**Decision: IMPLEMENT FIRST** (unanimous, lowest risk)

| Aspect | Consensus |
|--------|-----------|
| Mechanism | PAI tool (`WorkArchival.ts`), not cron — consistent with existing patterns (SessionHarvester, LearningPatternSynthesis) |
| Threshold | Archive COMPLETED WORK/ dirs older than 90 days |
| Destination | `WORK/ARCHIVE/YYYY-MM/` (compressed) |
| Routing | Must update LoadContext scanning index atomically |
| Current state | 183+ WORK/ dirs, LoadContext scans 30 per startup |
| Risk | Near-zero — read-only completed data, reversible |

### Verdict 2: Reflections/Synthesis Readback

**Decision: IMPLEMENT SECOND** (4/5 initial, 5/5 after design refinement)

| Aspect | Consensus |
|--------|-----------|
| Architecture | Scheduled synthesis job (LearningPatternSynthesis.ts already exists) → one readback function |
| Readback | Single `loadLatestSynthesis()` function in `learning-readback.ts` |
| Source | Latest `LEARNING/SYNTHESIS/` weekly-patterns file — NOT raw `algorithm-reflections.jsonl` |
| Budget | Brevity enforced at write-time (256-token cap per synthesis entry), not read-time truncation |
| Count | One recent synthesis (Ava conceded trajectory detection to simplicity) |
| Context cap | Total learning readback must stay under 2500 chars (Serena's constraint) |
| Risk | Low — read-only addition, no write-path changes |

**Key insight from debate:** Raw reflections are noise. The synthesis job is the materialized view. Don't read the log — read the summary.

### Verdict 3: CorrectionMode via RatingCapture Extension

**Decision: IMPLEMENT THIRD** (4/5 initial, 5/5 after RatingCapture design)

| Aspect | Consensus |
|--------|-----------|
| Architecture | Extend existing RatingCapture hook — NOT a new hook |
| Detection | Reuse correction patterns already at RatingCapture lines 192-195 |
| Threshold | High confidence (>=0.8) before emitting system-reminder |
| Scope | Explicit corrections only ("no, I meant...", "that's wrong") — NOT refinements ("actually, let's try Y") |
| Output | Emit `<system-reminder>` on stdout forcing Read/Grep before Edit/Write |
| Reminder size | <200 characters (Serena's constraint) |
| Monitoring | Ship with telemetry; revisit at 30 days |
| Kill-switch | Configurable disable in settings.json (Guardian's safeguard) |
| Risk | Medium — alters model behavior mid-conversation on false positives |

**Key insight from debate:** Guardian's "category error" concern (sentiment patterns repurposed for behavioral directives) was valid but resolved by the confidence threshold. The detection surface already exists — the question was never "can we detect corrections?" but "should detection trigger behavioral change?" The threshold gate makes this safe.

---

## Priority & Implementation Order

```
┌─────────────────────────────────────────────────────────┐
│  #1  WORK/ Archival Tool                                │
│  Risk: LOW  │  Effort: SMALL  │  Impact: IMMEDIATE      │
│  → WorkArchival.ts, 90-day threshold, compress+archive  │
├─────────────────────────────────────────────────────────┤
│  #2  Reflections/Synthesis Readback                     │
│  Risk: LOW  │  Effort: TINY   │  Impact: CLOSES LOOP    │
│  → loadLatestSynthesis() in learning-readback.ts        │
├─────────────────────────────────────────────────────────┤
│  #3  CorrectionMode via RatingCapture                   │
│  Risk: MED  │  Effort: SMALL  │  Impact: HIGH VALUE     │
│  → Extend RatingCapture, 0.8 threshold, kill-switch     │
└─────────────────────────────────────────────────────────┘
```

**Note:** Champion proposed bundling #2 and #3 into a single PR. The council did not reach consensus on this — Vex and Serena prefer separate deliverables for independent testing.

---

## Rejected Proposals (from original report)

| Proposal | Council Position | Reason |
|----------|-----------------|--------|
| Two-temperature formalization | SKIP | Implicit model works; archival tool addresses the concrete symptom |
| Context scoring model (40/30/30) | SKIP | Adds Haiku LLM latency to startup; our file-sort approach is faster |
| Session dedup tracking | SKIP | Compaction handles adequately |
| New ContextAssembler hook | SKIP | Our LoadContext exceeds their proposal |
| Explicit token budgeting | DEFER | Addressed partially by 2500-char cap; revisit if quality issues arise |

---

## Open Questions — Resolved

1. **WorkArchival.ts invocation:** ✅ DECIDED — Invocable from the Algorithm. Not manual-only.
2. **CorrectionMode telemetry:** ✅ DECIDED — MANDATORY. See Council Telemetry Session below.
3. **Synthesis job scheduling:** DEFERRED — Revisit after archival and CorrectionMode land.

---

## Council Telemetry Session — CorrectionMode (Reconvened)

Telemetry declared **MANDATORY** by principal. Council reconvened with focused scope.

### Storage Decision: Dedicated `corrections.jsonl`

The council split on storage (Serena: extend ratings.jsonl vs. Guardian/Vex: new file). **Verdict: new file wins.** The 3-phase correlation chain (`triggered` → `verified` → `rated`) doesn't fit the single-line rating schema. Different lifecycle, independent rotation, and the kill-switch needs fast sequential reads over correction events only.

**Location:** `MEMORY/LEARNING/SIGNALS/corrections.jsonl`

### Schema

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
1. `phase: "triggered"` — on detection (includes confidence, prompt_preview, suppressed)
2. `phase: "verified"` — after verification tools observed (includes verification block)
3. `phase: "rated"` — when next rating captured (includes outcome block)

Joinable on `correction_id` for full correction lifecycle analysis.

### Metrics

| Metric | Type | Calculation | Target |
|--------|------|-------------|--------|
| **Precision** | Primary | confirmed corrections / total firings | >= 70% |
| **Verification compliance** | Leading | % of firings where Read/Grep preceded Edit/Write | >= 80% |
| **Rating delta** | Outcome | avg(outcome.rating - trigger_rating) | > 0 |
| **Turns to resolution** | Outcome | avg turns from correction to user satisfaction | Decreasing trend |
| **False positive rate** | Safety | corrections where delta <= 0 / total firings | < 30% |
| **Correction rate** | Volume | corrections / total prompts (rolling 50-prompt window) | < 25% |
| **Suppressed events** | Counterfactual | below-threshold detections (implicit control group) | Logged always |

### Auto-Kill-Switch

**Self-gating (no external cron):** Before emitting each system-reminder, the hook checks:

1. Read last 20 `phase: "rated"` entries from `corrections.jsonl`
2. Compute rolling average `delta_from_trigger`
3. **If avg delta <= 0** → corrections aren't improving outcomes → skip injection, log `suppressed: true` with reason `"killswitch_delta"`
4. **If false positive rate > 30%** over rolling 7-day window → auto-disable
5. **If 3 consecutive false positives** → immediate auto-disable

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

**Re-enable:** Manual only via settings.json or state file edit. Auto-re-enable after 7 days to re-test (Vex's proposal).

### Configurable Review Period

**Default: 7 days.** Configurable via `review_period_days` in state file.

At the end of each review period:
1. Auto-generate a review summary (written to `LEARNING/SIGNALS/correction-reviews/YYYY-MM-DD.md`)
2. Reset rolling counters for the next period
3. Set `next_review_at` to current time + `review_period_days`
4. If review fails decision framework (2 of 3 core metrics failing), auto-disable with reason `"review_failed"`

**Review trigger:** Checked inline at each correction detection. If `now >= next_review_at`, run the review before proceeding. No cron needed.

Suggested cadence:
- **7 days** (default) — tight feedback loop during initial rollout
- **14 days** — once stable, reduce review overhead
- **30 days** — long-term steady state

### Verbose Mode

**Default: off.** Configurable via `verbose: true` in state file.

When verbose is enabled, CorrectionMode surfaces telemetry metrics inline during sessions at contextually appropriate moments:

**When metrics are displayed:**
- **After a correction fires and resolves** — show the correction lifecycle (confidence → verification → outcome delta)
- **At Algorithm VERIFY phase** — if corrections occurred during the session, show session correction summary
- **At session start (LoadContext)** — when `loadCorrectionTrends()` fires, verbose expands from a one-liner to a 3-5 line block with period stats

**Verbose output examples:**

After a correction resolves:
```
📊 CorrectionMode: confidence 0.87 → verified (Read×2, Grep×1) → rating +4 delta
```

At Algorithm VERIFY phase (if corrections occurred this session):
```
📊 CorrectionMode session summary:
   Corrections: 2 triggered, 2 verified, 1 rated
   Compliance: 100% | Avg delta: +3.5 | Period precision: 78%
```

At session start (verbose LoadContext):
```
📊 CorrectionMode [period 3/7 days]: 8 triggers, 87% compliance, +2.8 avg delta, ACTIVE
   Kill-switch: healthy (delta +2.8, FP rate 12%, no consecutive FPs)
```

**When verbose is off:** Only the existing one-liner from `loadCorrectionTrends()` appears at session start. No mid-session output.

**Why "appropriate" means these 3 moments:** They align with natural reflection points — post-correction (immediate feedback), VERIFY phase (session retrospective), and session start (period overview). No mid-task interruptions.

### Integration with Existing Pipeline

| System | Integration |
|--------|------------|
| `learning-cache.sh` | Add `correction_trigger_count`, `correction_compliance_rate`, `correction_avg_delta` |
| `learning-readback.ts` | Add `loadCorrectionTrends()` → one-liner: "CorrectionMode: N triggers, X% compliance, +Y avg delta, status" |
| `LoadContext` | Correction trends surfaced at session start via existing readback mechanism |
| `LearningPatternSynthesis` | Gains `source` grouping dimension for correction vs. non-correction sessions |
| `events.jsonl` | `correction.triggered`, `correction.verified`, `correction.disabled` event types via appendEvent() |

### Counterfactual Measurement (Ava's Framework)

Track ALL correction detections — both fired and suppressed:
- **Fired events:** CorrectionMode active, confidence >= 0.8
- **Suppressed events:** Below threshold (0.6-0.79) or kill-switch active
- Compare `turns_to_resolution` between fired vs. suppressed groups
- This provides the implicit control group without requiring A/B periods

Minimum 30 correction events needed for meaningful analysis. If fewer than 30 events by review date, auto-extend `review_period_days` by 7 and log reason.

### Periodic Review Report

Generated automatically at each `review_period_days` boundary (default: 7 days). Written to `LEARNING/SIGNALS/correction-reviews/YYYY-MM-DD.md`.

1. Total corrections: triggered, verified, rated (completion funnel)
2. Precision: confirmed / total (target >= 70%)
3. Verification compliance rate (target >= 80%)
4. Average rating delta for fired vs. suppressed (counterfactual)
5. Top 5 pattern_matched categories by frequency
6. Kill-switch activations (count, dates, reasons)
7. Session comparison: avg final rating in correction sessions vs. non-correction sessions
8. Sample size assessment: sufficient for conclusions?
9. **Decision: KEEP / TUNE THRESHOLD / DEPRECATE**

Decision framework (Ava): 2 of 3 core metrics failing = redesign. All 3 failing = kill.

When verbose mode is on, the review summary is also surfaced at the next session start via `loadCorrectionTrends()` expanded output.

---

## Appendix: Debate Arc

```
Round 1: 2 ACCEPT, 1 MIXED, 1 OPPOSE-MOST, 1 REJECT-ALL
Round 2: 4 ACCEPT-WITH-DESIGN, 1 PARTIAL-CONCEDE
Round 3: 5/5 UNANIMOUS (with design refinements)

Key turning point: Vex's RatingCapture extension proposal (Round 1)
dissolved Guardian's primary objection and unified the council's
implementation approach.

Telemetry session: Vex's 3-phase correlation chain and self-gating
kill-switch unified the council. Ava's counterfactual framework
(suppressed events as control group) was the key methodological
contribution. Guardian's precision threshold (>=70%) became the
primary success gate.
```
