# Internal Signals — Combined Learning Synthesis

**Generated:** 2026-03-07
**Workflow:** Learning/Synthesize (MineReflections + MineRatings in parallel)

---

## Algorithm Reflections

**Source:** `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
**Entries analyzed:** 24 | **High-signal:** 2 (criteria_failed > 0)
**Date range:** 2026-02-20 to 2026-03-05

### Pre-read all target files before editing (4 occurrences, MEDIUM signal)
**Root cause:** BUILD phase begins editing without reading all target files first, causing errors and round-trips.
**Proposed fix:** Add mandatory "pre-read targets" step at start of BUILD.
**Target:** `PAI/Algorithm/v3.7.0.md`
**Evidence:**
- [2026-02-20] Full content pass — "pre-read all files that needed modification at the very beginning of BUILD, eliminating the read-before-edit bottleneck"
- [2026-02-26] Integrate lang-doc content — "should have batched the file reads more aggressively in Phase 0"
- [2026-02-26] Create ARCHITECTURE.md — "wc -l vs Read tool line-count discrepancy"

### Read existing tooling before improvising (4 occurrences, HIGH signal)
**Root cause:** OBSERVE doesn't mandate checking existing skills/tools before planning new work.
**Proposed fix:** Add "scan existing skills and tooling for prior art" sub-step to OBSERVE.
**Target:** `PAI/Algorithm/v3.7.0.md`
**Evidence:**
- [2026-02-22] Branch Session — "checked the skill discovery mechanism in OBSERVE rather than discovering it during BUILD"
- [2026-03-04] YouTube check — "Should have read PAIUpgrade SKILL.md and Tools directory before building manual search strategy"
- [2026-03-04] YouTube check — "read existing skill tooling before improvising"
- [2026-03-05] Extract learning pipeline — "Architect agent directly read existing SKILL.md files for precise templating"

### Maximize parallelization of independent ops (7 occurrences, MEDIUM signal)
**Root cause:** Independent operations sequenced unnecessarily — agent launches, verification checks, file writes, npm installs.
**Proposed fix:** Add dependency analysis micro-step in PLAN to identify parallel-safe operations.
**Target:** `PAI/Algorithm/v3.7.0.md`
**Evidence:**
- [2026-02-26] Integrate lang-doc — "launched Engineer agents immediately after Phase 0, without waiting for Phase 1"
- [2026-02-26] Create ARCHITECTURE.md — "Could have parallelised the verification checks more aggressively"
- [2026-02-27] Bug fixes — "Could have parallelised the test file writes"
- [2026-02-23] Issue Session — "The 'foundation first, then parallel' pattern is a reusable template"

### Copy sibling file conventions (2 occurrences, HIGH signal)
**Root cause:** New files created without checking siblings for permissions/patterns.
**Proposed fix:** Read at least one sibling file before creating new files in existing directories.
**Evidence:**
- [2026-03-02] Test ReflectionCapture — "checked file permissions of sibling hooks before writing new ones, copying their permission bits automatically"
- [2026-03-05] Extract learning pipeline — "read existing SKILL.md files for precise templating"

### ISC templates for recurring task types (2 occurrences, MEDIUM signal)
**Root cause:** Framework migrations, viability reviews share 80%+ structure but ISC built from scratch each time.
**Proposed fix:** Create reusable ISC template library (framework-migration, viability-review, content-creation, etc.).
**Evidence:**
- [2026-02-21] Solve Session — "explicit 'framework migration' ISC template — scaffolding criteria for config parity, content format parity, build chain parity"
- [2026-02-27] Dotfiles viability — "fast-tracked to a decision framework rather than spending time on ISC for what is fundamentally a strategic question"

### Effort level misclassification (2 occurrences, MEDIUM signal)
**Root cause:** Multi-agent investigation tasks classified as Standard when they should be Extended.
**Proposed fix:** Add heuristic: if task involves sub-agents, multi-file investigation, or debugging, auto-escalate to Extended.
**Evidence:**
- [2026-03-05] Extract learning pipeline — "Should have classified as Extended effort immediately"
- [2026-02-27] Dotfiles viability — "detected the 'project viability review' pattern earlier"

### Incremental build validation (2 occurrences, MEDIUM signal)
**Root cause:** All files written then built once — batch errors harder to diagnose.
**Proposed fix:** For build-producing tasks, add checkpoint builds after each major phase.
**Evidence:**
- [2026-02-21] Solve Session — "run the build incrementally — scaffold first, build, add content, build, add features, build"
- [2026-02-21] Solve Session — "MDX 3 compatibility issue was caught at build time but could have been anticipated during PLAN"

---

### Execution Pattern Warnings (from Q1)

- **File-not-read errors from editing before reading** — most frequent Q1 mistake (3 occurrences)
- **Unnecessary sequential operations** when parallel execution was possible (4 occurrences)
- **Searching for mechanisms that could have been Grep'd** in OBSERVE (2 occurrences)
- **Minor syntax oversights** (tilde escaping, duplicate config keys) costing fix cycles (2 occurrences)
- **Tool output discrepancies** (wc -l vs Read tool) — use authoritative CLI tools for counts (1 occurrence)

### Aspirational Insights (from Q3)

- **Direct writing beats delegation** when source material is already in context — delegation overhead (~60s) may exceed direct work time
- **Incremental validation** catches issues at introduction rather than as a batch
- **Pattern recognition** should reduce THINK to near-zero for well-known patterns
- **Auto-generate test harnesses** alongside scripts for near-instant verification
- **Proactive project health monitoring** — flag structural issues before user frustration builds
- **Council skill for boundary decisions** — use debate for ambiguous ownership questions
- **Pre-compose known edits** concurrently with agent launches when paths are deterministic

---

## Behavioral Signals from Ratings

**Source:** `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl`
**Entries analyzed:** 760 | **Explicit feedback:** 16 | **Problem sessions:** 7
**Mean rating:** 5.09 | **Date range:** 2026-01-26 to 2026-03-06

### STOP (Low-Rating Patterns)

- **Acting on wrong information or ignoring corrections** (26 occurrences, avg 3.42) — the dominant negative signal. When corrected, apply the correction; do not persist on the wrong path.
- **Taking autonomous action when user wanted information only** (worst session avg 3.9) — "acted instead of informing," "misunderstanding and need to undo work," "dismissive rejection of proposed action"
- **Asserting without verification** (multiple occurrences) — claiming files/docs are correct without checking
- **Repeated failed attempts without changing approach** (rating 2) — when something isn't working, change strategy immediately
- **Providing unclear/incomplete information** (2 occurrences, avg 3.0)
- **Overcomplicating** (1 occurrence, rating 4) — unnecessary code in codebase

### DO MORE (High-Rating Patterns)

- **Thorough, comprehensive research with synthesis** (11 occurrences, avg 8.82) — #1 positive signal
- **Moments that impress or delight** (13 occurrences, avg 8.77) — ethical judgment, boundary-setting, surprising depth
- **Solution-first, concise output with references** (rating 10: "110 lines, all references linked")
- **Precise technical fixes** (rating 9: "Fixing MineRatings CWD bug")

### Explicit User Feedback (highlights)

- [Rating 10] "Solution-first, 110 lines, all references linked"
- [Rating 9] "Fixing MineRatings CWD bug" — precise, correct technical fix
- [Rating 9] "Craft follow-up message citing evidence of pattern" — well-researched writing
- [Rating 1] "Wrong order -- I said them backwards. Correcting"
- [Rating 2] Repeated failed attempts and incomplete solutions
- [Rating 2] Commit/push/PR creation issues

### Problem Sessions (avg rating <= 4)

- **Worst:** session 094aebb2 (10 entries, avg 3.9) — acted without being asked, misunderstood intent, needed to undo work
- Several single-entry sessions with frustration about wrong research targets, unclear explanations, or behaviors not triggering correctly

---

## Cross-Reinforced Signals

Where reflection themes and rating patterns point to the same issue — these are the highest-confidence upgrade priorities.

### 1. Verify before asserting (STRONGEST combined signal)
- **Reflection:** "Read existing tooling before improvising" (4 occurrences)
- **Rating:** STOP "asserting without verification" + STOP "acting on wrong information" (26 occurrences)
- **Combined insight:** Investigate first, act second. Both data sources say the same thing from different angles.

### 2. Thoroughness wins
- **Reflection:** "Direct writing beats delegation when source is in context"
- **Rating:** DO MORE "comprehensive research with synthesis" (avg 8.82)
- **Combined insight:** Depth and precision are rewarded. Don't trade quality for speed via unnecessary delegation.

### 3. Don't repeat failures
- **Reflection:** "Unnecessary sequential operations" (7 occurrences)
- **Rating:** STOP "repeated failed attempts without changing approach" (rating 2)
- **Combined insight:** When something isn't working, change strategy immediately rather than retrying.

---

## Data Quality Notes

- 14 of 24 reflection entries (58%) have null Q1/Q2/Q3 — auto-hook captures with only a `learning` field. Lower mining value.
- All early reflection entries have `implied_sentiment: 6`, suggesting the auto-hook defaults rather than genuinely estimating.
- `criteria_passed` is 0 for most older entries — hook captured count but not completion status.
- Rating distribution is heavily concentrated at 5 (652 of 760 entries, 86%) — suggests the implicit rating hook defaults to 5, making the non-5 entries the true signal.
