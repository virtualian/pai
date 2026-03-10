# ReinforcementMode Design: Unified Behavioral Feedback System

**Issue:** #73 (Continuous HITL Learning Cycle)
**Branch:** `73-continuous-hitl-learning-cycle`
**Date:** 2026-03-10
**Status:** Implemented (2026-03-10)

---

## Problem

PAI's learning system is asymmetric. CorrectionMode detects negative patterns (corrections, frustration) and intervenes in real-time via system-reminders. But positive signals — high ratings, praise, satisfaction — are captured as data points and never acted on. The loop is open:

```
Negative: Behavior → Correction → system-reminder → Changed behavior → Improved outcome
Positive: Behavior → Praise → Data point → STOP
```

38 high-rating entries (8-10) exist in `ratings.jsonl` with `response_preview` data showing what behaviors earned them, but this data is never surfaced or reinforced.

## Design Decision: Unified Architecture

Rather than building a separate ReinforcementMode alongside CorrectionMode, unify the data layer:

```
RatingCapture.hook.ts
  │
  ├── [FAST PATH] detectCorrection() — regex, sync, ~5ms
  │     └── writes to behavioral-signals.jsonl (signal_type: "correction")
  │     └── emits system-reminder (real-time intervention)
  │
  ├── [AFTER RATING WRITE] captureReinforcement() — async, post-write
  │     └── writes to behavioral-signals.jsonl (signal_type: "reinforcement")
  │     └── NO system-reminder (readback at session start only)
  │
  └── Shared:
        ├── behavioral-signals.jsonl    (unified telemetry)
        ├── behavioral-feedback.json    (unified state)
        └── loadBehavioralTrends()      (unified readback)
```

**Why unified:**
- Corrections and reinforcements are the same signal axis (negative/positive poles)
- Shared JSONL format, state management, readback pattern
- Eliminates code duplication (writer, state manager, readback)
- Single readback function surfaces both "avoid this" and "do more of this"
- CorrectionMode refactor cost is low (just built, no downstream consumers)

**Why detection stays separate:**
- CorrectionMode is synchronous fast-path (5ms regex, before sentiment analysis)
- ReinforcementMode is async post-write (after rating is determined)
- Different intervention types (real-time reminder vs session-start readback)

---

## Component 1: Detection Triggers

### Reinforcement triggers (rating >= 8)

| Source | Trigger Point | Line in RatingCapture.hook.ts | Data Available |
|--------|--------------|-------------------------------|----------------|
| Explicit rating >= 8 | After `writeRating()` in Path 1 | ~826 | rating, comment, response_preview |
| Positive praise fast-path | After `writeRating()` in praise block | ~914 | rating=8, prompt, response_preview |
| Implicit sentiment >= 8 | After `writeRating()` in Path 2 | ~958 | rating, sentiment_summary, response_preview |

### Confidence thresholds

| Signal Source | Min Rating | Min Confidence | Rationale |
|---------------|-----------|----------------|-----------|
| Explicit rating | 8 | N/A (explicit = 1.0) | User went out of their way to rate high |
| Praise fast-path | 8 | 0.95 (hardcoded) | Short praise is high-signal |
| Implicit sentiment | 8 | 0.7 | Higher bar than general sentiment (0.5) to avoid false reinforcement |

### Correction triggers (unchanged from current CorrectionMode)

7 regex patterns with confidence >= 0.8, refinement exclusions, kill-switch check. No changes needed — just rename the output target from `corrections.jsonl` to `behavioral-signals.jsonl`.

---

## Component 2: Behavior Classification

### Approach: Regex-only (inference fallback deferred)

The existing PAI output format (NATIVE/ALGORITHM) contains structured markers that reveal what the AI was doing. Extract behavior type from these markers with regex (~5ms). Unclassified responses get confidence 0.5, which falls below the 0.7 capture threshold and are silently skipped.

> **Design note:** Inference fallback was in the original design but deferred from implementation. The `unclassified` type returns confidence 0.5 which is filtered by `shouldCaptureReinforcement()`. This is intentional — we collect data on how often classification fails before investing in inference overhead.

### Regex extraction from structured output

```typescript
const BEHAVIOR_MARKERS: Array<{
  pattern: RegExp;
  behavior: BehaviorType;
  confidence: number;
}> = [
  { pattern: /✅\s*VERIFY/, behavior: 'thorough-verification', confidence: 0.90 },
  { pattern: /\b(diff|verified|confirmed|checked|tested)\b/i, behavior: 'thorough-verification', confidence: 0.85 },
  { pattern: /\b(report|doc|summary|wrote|documented)\b.*\b(created|saved|written)\b/i, behavior: 'clear-documentation', confidence: 0.80 },
  { pattern: /\b(1-line|single|minimal|targeted|surgical)\b.*\b(fix|change|patch|diff)\b/i, behavior: 'surgical-precision', confidence: 0.85 },
  { pattern: /🔄\s*ITERATION/, behavior: 'iterative-improvement', confidence: 0.85 },
  { pattern: /\b(cited|referenced|linked|source|evidence|API response)\b/i, behavior: 'evidence-based', confidence: 0.80 },
  { pattern: /\b(deployed|running|working|functional|live|posted)\b/i, behavior: 'working-output', confidence: 0.75 },
];
```

Patterns are evaluated in order — higher-confidence structured markers (✅ VERIFY) match before broader word-level patterns.

### Behavior taxonomy

| Type | Description | Example from actual 8+ ratings |
|------|-------------|-------------------------------|
| `thorough-verification` | Used diffs, checked actual state, verified claims | "Diffed every claimed file between v4.0.2 and v4.0.3" (10/10) |
| `clear-documentation` | Created well-structured reports/summaries | "good doc" — issue-850 verification report (8/10) |
| `surgical-precision` | Small, targeted change that fixed the exact issue | "Replaced spawn with direct import" — MineRatings fix (9/10) |
| `iterative-improvement` | Improved based on feedback, got it right on retry | "better!" — aspiration disclaimers (8/10) |
| `evidence-based` | Cited sources, showed proof, linked references | "Every quote verified against actual API responses" (9/10) |
| `working-output` | Produced functional, usable output | "great. that works" — posted to issue (9/10) |
| `good-communication` | Clear format, right level of detail, concise | "the site is looking great now" — skill listing (9/10) |
| `unclassified` | Fallback when no markers match | Returns confidence 0.5, filtered by 0.7 threshold |

> **Deferred:** Haiku inference fallback for `unclassified` was designed but not implemented. If regex classification miss rate is high (observable in behavioral-signals.jsonl), add inference at that point.

---

## Component 3: Unified Telemetry Schema

### behavioral-signals.jsonl

```typescript
interface BehavioralSignal {
  // Common fields (both correction and reinforcement)
  timestamp: string;              // ISO-8601
  session_id: string;
  signal_id: string;              // "corr_YYYYMMDD_HHMMSS" | "reinf_YYYYMMDD_HHMMSS"
  signal_type: 'correction' | 'reinforcement';
  phase: 'triggered' | 'verified' | 'rated';
  confidence: number;

  // Correction-specific
  pattern_matched?: 'negation_correction' | 'redirect' | 'behavioral' | 'repeated_request';
  suppressed?: boolean;
  suppressed_reason?: string;

  // Reinforcement-specific
  rating?: number;
  rating_source?: 'explicit' | 'implicit';
  behavior_type?: BehaviorType;
  behavior_summary?: string;

  // Shared context
  prompt_preview: string;         // What the user said (60 chars)
  response_preview?: string;      // What the AI did (500 chars)

  // Outcome (populated in 'rated' phase)
  outcome?: {
    delta_from_trigger: string;   // Rating change after intervention
  };
}

type BehaviorType =
  | 'thorough-verification'
  | 'clear-documentation'
  | 'surgical-precision'
  | 'iterative-improvement'
  | 'evidence-based'
  | 'working-output'
  | 'good-communication'
  | 'unclassified';
```

### Example entries

**Correction signal:**
```json
{
  "timestamp": "2026-03-10T12:00:00-08:00",
  "session_id": "abc-123",
  "signal_id": "corr_20260310_120000",
  "signal_type": "correction",
  "phase": "triggered",
  "confidence": 0.92,
  "pattern_matched": "negation_correction",
  "suppressed": false,
  "prompt_preview": "No, I meant rename not delete"
}
```

**Reinforcement signal:**
```json
{
  "timestamp": "2026-03-10T14:30:00-08:00",
  "session_id": "abc-123",
  "signal_id": "reinf_20260310_143000",
  "signal_type": "reinforcement",
  "phase": "triggered",
  "confidence": 0.85,
  "rating": 9,
  "rating_source": "explicit",
  "behavior_type": "thorough-verification",
  "behavior_summary": "Verified all claims with diffs and API responses",
  "prompt_preview": "great results from MineRatings",
  "response_preview": "Replaced spawn with direct import..."
}
```

---

## Component 4: Unified State File

### behavioral-feedback.json

```typescript
interface BehavioralFeedbackState {
  // Global
  enabled: boolean;
  verbose: boolean;

  // Correction tracking (migrated from correction-mode.json)
  correction: {
    enabled: boolean;
    review_period_days: number;
    auto_disabled_at: string | null;
    auto_disabled_reason: string | null;
    lifetime_corrections: number;
    lifetime_false_positives: number;
    review_started_at: string;
    next_review_at: string;
  };

  // Reinforcement tracking (NEW)
  reinforcement: {
    enabled: boolean;
    lifetime_reinforcements: number;
    behavior_frequency: Record<BehaviorType, number>;
    top_behaviors: BehaviorType[];        // Sorted by frequency, top 5
    last_reinforcement_at: string | null;
    saturation_threshold: number;         // Default: 20 per behavior type
  };
}
```

### Default state

```json
{
  "enabled": true,
  "verbose": false,
  "correction": {
    "enabled": true,
    "review_period_days": 7,
    "auto_disabled_at": null,
    "auto_disabled_reason": null,
    "lifetime_corrections": 0,
    "lifetime_false_positives": 0,
    "review_started_at": "2026-03-10T00:45:00Z",
    "next_review_at": "2026-03-17T00:45:00Z"
  },
  "reinforcement": {
    "enabled": true,
    "lifetime_reinforcements": 0,
    "behavior_frequency": {},
    "top_behaviors": [],
    "last_reinforcement_at": null,
    "saturation_threshold": 20
  }
}
```

---

## Component 5: Over-Reinforcement Guard

CorrectionMode has a kill-switch that auto-disables when corrections aren't helping (avg delta <= 0 or 3 consecutive false positives). ReinforcementMode needs an equivalent guard against noise:

### Saturation guard

| Rule | Threshold | Action |
|------|-----------|--------|
| Behavior type saturated | >= 20 signals for one type | Stop logging that type (it's a known pattern) |
| Total reinforcements per session | > 3 | Cap at 3 per session to avoid noise |
| Classification confidence too low | < 0.7 | Skip logging (don't reinforce uncertain signals) |
| Readback staleness | > 30 days since last signal | Omit readback section entirely |

### Implementation

Session reinforcement count is tracked via a module-level `let sessionReinforcementCount = 0` variable. Since the hook runs as a separate bun process per `UserPromptSubmit` event, this naturally resets per invocation — no cross-session leakage.

```typescript
let sessionReinforcementCount = 0;

function shouldCaptureReinforcement(
  state: BehavioralFeedbackState,
  behaviorType: BehaviorType,
  confidence: number,
): { capture: boolean; reason?: string } {
  if (!state.enabled || !state.reinforcement.enabled) {
    return { capture: false, reason: 'disabled' };
  }
  if (confidence < 0.7) {
    return { capture: false, reason: 'low_confidence' };
  }
  if (sessionReinforcementCount >= 3) {
    return { capture: false, reason: 'session_cap' };
  }
  const freq = state.reinforcement.behavior_frequency[behaviorType] || 0;
  if (freq >= state.reinforcement.saturation_threshold) {
    return { capture: false, reason: 'saturated' };
  }
  return { capture: true };
}
```

---

## Component 6: Readback Integration

### loadBehavioralTrends() — replaces loadCorrectionTrends()

```typescript
export function loadBehavioralTrends(paiDir: string): string | null {
  // Reads behavioral-feedback.json state
  // Reads behavioral-signals.jsonl (full file read)
  // Filters by signal_type to compute correction + reinforcement stats
  // Returns compact summary for session context injection
}
```

> **Future optimization:** Currently reads the entire `behavioral-signals.jsonl` file. When the file grows large (10K+ entries), apply the same tail-read optimization used by `checkKillSwitch()` (4KB buffer, ~13 entries). Deferred since the file currently has zero entries.

### Output format (target: <=400 chars)

When both correction and reinforcement data exist:
```
**Behavioral Feedback:** Corrections: 5 triggers, 80% compliance, +2.1 delta, ACTIVE | Reinforcements: 12 signals | Top: thorough-verification (5), evidence-based (3), surgical-precision (2) | Latest: "Verified claims with diffs" (9/10)
```

When only corrections exist (early days):
```
**Behavioral Feedback:** Corrections: 5 triggers, 80% compliance, +2.1 delta, ACTIVE | Reinforcements: none yet
```

When only reinforcements exist:
```
**Behavioral Feedback:** Reinforcements: 12 signals | Top: thorough-verification (5), evidence-based (3) | Latest: "Created thorough report" (8/10)
```

### LoadContext.hook.ts wiring

```typescript
// Line 39:
import { ..., loadBehavioralTrends } from './lib/learning-readback';

// Line 485:
const behavioralTrends = loadBehavioralTrends(paiDir);

// Line 489:
if (behavioralTrends) learningParts.push(behavioralTrends);
```

---

## Component 7: RatingCapture Integration Points

### captureReinforcement()

Inserted after each rating write point. Awaited before `process.exit(0)` to ensure writes complete. Early exit (`rating < 8`) resolves immediately with negligible overhead.

```typescript
async function captureReinforcement(
  rating: number,
  source: 'explicit' | 'implicit',
  prompt: string,
  responsePreview: string,
  sessionId: string,
  comment?: string,
): Promise<void> {
  if (rating < 8) return;

  const state = loadBehavioralFeedbackState();
  if (!state?.reinforcement?.enabled) return;

  // Classify behavior (regex-only, no inference fallback)
  const classification = classifyBehavior(responsePreview, prompt, comment);

  // Check saturation guard
  const guard = shouldCaptureReinforcement(state, classification.behavior_type, classification.confidence);
  if (!guard.capture) {
    console.error(`[ReinforcementMode] Skipped (${guard.reason})`);
    return;
  }

  // Write signal
  writeBehavioralSignal({
    timestamp: getISOTimestamp(),
    session_id: sessionId,
    signal_id: generateReinforcementId(),
    signal_type: 'reinforcement',
    phase: 'triggered',
    confidence: classification.confidence,
    rating,
    rating_source: source,
    behavior_type: classification.behavior_type,
    behavior_summary: classification.behavior_summary,
    prompt_preview: safeSlice(prompt.trim(), 60),
    response_preview: safeSlice(responsePreview, 500),
  });

  sessionReinforcementCount++;
  updateReinforcementState(state, classification.behavior_type);

  console.error(
    `[ReinforcementMode] Captured: ${classification.behavior_type} ` +
    `(${classification.confidence}) for rating ${rating}`
  );
}
```

### Insertion points in RatingCapture.hook.ts

| Location | After Line | Context |
|----------|-----------|---------|
| Explicit rating path | ~826 (after `writeRating`, before low rating check) | `await captureReinforcement(explicitResult.rating, 'explicit', prompt, cachedResponse \|\| '', data.session_id, explicitResult.comment);` |
| Praise fast-path | ~914 (before `process.exit(0)`) | `await captureReinforcement(8, 'implicit', prompt, cachedResponse \|\| '', data.session_id);` |
| Implicit sentiment path | ~958 (after `writeRating()`) | `await captureReinforcement(sentiment.rating, 'implicit', prompt, implicitCachedResponse \|\| '', data.session_id, undefined);` |

---

## Migration (Completed)

CorrectionMode had zero production entries. Clean rename with no backward compatibility needed:

1. ✅ Constants renamed: `CORRECTIONS_FILE` → `BEHAVIORAL_SIGNALS_FILE`, `CORRECTION_MODE_STATE` → `BEHAVIORAL_FEEDBACK_STATE`
2. ✅ `signal_type: 'correction'` added to all correction signal writes
3. ✅ `signal_id` field replaces `correction_id` in signal entries
4. ✅ State restructured: flat `CorrectionModeState` → nested `BehavioralFeedbackState` with `correction:` and `reinforcement:` sections
5. ✅ `loadCorrectionTrends()` → `loadBehavioralTrends()` in learning-readback.ts
6. ✅ `writeCorrectionEntry()` → `writeBehavioralSignal()` (shared by both signal types)
7. ✅ `generateCorrectionId()` and `generateReinforcementId()` consolidated into shared `generateSignalId(prefix)` helper
8. ✅ `behavioral-feedback.json` created at `~/.claude/MEMORY/STATE/`
9. ✅ Zero references to old names remain in hooks directory

---

## Context Budget Impact

| Component | Current Chars | After Change |
|-----------|-------------|-------------|
| Performance Signals | ~120 | ~120 (unchanged) |
| CorrectionMode trends | ~90 | 0 (replaced) |
| **Behavioral Feedback** | 0 | ~350 (unified) |
| Wisdom Frames | ~200 | ~200 (unchanged) |
| Latest Synthesis | ~400 | ~400 (unchanged) |
| Learning Digest | ~300 | ~300 (unchanged) |
| Failure Patterns | ~250 | ~250 (unchanged) |
| **Total** | **~1360** | **~1620** |

Delta: +260 chars. Well within the 2500 char budget.

---

## Files Changed

| File | Change |
|------|--------|
| `RatingCapture.hook.ts` | +130 lines: `BehaviorType`, `BehavioralSignal`, `BehavioralFeedbackState` types; `BEHAVIOR_MARKERS` array (7 patterns); `classifyBehavior()`, `shouldCaptureReinforcement()`, `captureReinforcement()`, `updateReinforcementState()`, `generateSignalId()` functions; renamed constants/functions to unified naming; wired `captureReinforcement` at 3 `writeRating` points |
| `learning-readback.ts` | Replaced `loadCorrectionTrends()` with `loadBehavioralTrends()` — reads both correction and reinforcement data from unified signals file, produces combined output |
| `LoadContext.hook.ts` | 3-line change: import rename + call rename |
| `behavioral-feedback.json` | New unified state file at `~/.claude/MEMORY/STATE/` (replaces `correction-mode.json`) |

### Post-implementation cleanup (/simplify)

- Removed unused `CorrectionModeState` type alias (dead code)
- Fixed redundant `text.substring(0, 80)` before `safeSlice(text, 80)` — simplified to `safeSlice(text, 80)`
- Removed TOCTOU `existsSync` check before `mkdirSync({ recursive: true })` in `writeBehavioralSignal`
- Consolidated `generateCorrectionId()` + `generateReinforcementId()` into shared `generateSignalId(prefix)` helper

---

## What This Does NOT Include (Deferred)

| Item | Why Deferred |
|------|-------------|
| Real-time system-reminder for positive signals | Low value — "keep doing that" doesn't change behavior like "stop and verify" does |
| Haiku inference fallback for `unclassified` behaviors | Collect data on regex miss rate first; `unclassified` returns confidence 0.5 which is filtered by the 0.7 threshold |
| Tail-read optimization in `loadBehavioralTrends()` | File has zero entries — premature optimization; apply when file grows (use same 4KB tail-read as `checkKillSwitch()`) |
| `BehavioralSignal` type enforcement on `writeBehavioralSignal()` | Function accepts `Record<string, unknown>` — would require changing all correction write call sites for type safety |
| Correction `verified` phase | Needs PostToolUse observer (separate work item) |
| Correction `rated` phase | Needs cross-hook correlation (depends on verified) |
| Synthesis integration | Needs both correction and reinforcement data to be meaningful |
| Correlation between correction → reinforcement | "You were corrected, then earned praise for the corrected behavior" — requires correction-rated phase first |
