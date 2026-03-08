# Issue #26 — Learning Pipeline Verification Report

**Date:** 2026-03-01
**Issue:** [virtualian/pai#26](https://github.com/virtualian/pai/issues/26)
**Comment under review:** [#issuecomment-3981102605](https://github.com/virtualian/pai/issues/26#issuecomment-3981102605)

---

## Executive Summary

**A fresh v4.0.2 upstream install works — nothing crashes.** But it ships a dead-end pipeline: the Algorithm produces reflections, three workflows expect to read them, documentation describes the data file, but no hook ever writes to it. Same for ratings — they're captured but no tool analyzes them. It's not a runtime bug, it's infrastructure that was designed and documented but never wired up.

This is confirmed by the upstream community: Discussion #531 ("Is the Learning System Actually Learning?", 10 comments, open) and PR #735 (attempted fix, closed without merge).

The issue #26 comment's claim of "~80% complete" is roughly correct for v4.0.2. The local install on this machine had additional files (from v3.0 era + one locally-created handler) that briefly made the pipeline work, but those are irrelevant to the upstream state.

---

## Claim-by-Claim Verification

### 1. "Algorithm LEARN phase — Q1/Q2/Q3/Q4 reflection output fully defined"

**VERIFIED: TRUE**

Location: `Releases/v4.0.1/.claude/PAI/Algorithm/v3.5.0.md` lines 293-306

```
LEARN 7/7 defines FOUR questions:
  Q1: What should I have done differently in the execution of the algorithm?
  Q2: What would a smarter algorithm have done instead?
  Q3: What capabilities from the skill index should I have used that I didn't?
  Q4: What would a smarter AI have designed as a better algorithm?
```

**Note:** The Algorithm defines Q1-Q4, but MineReflections.md only documents Q1-Q3. Q4 is produced by the Algorithm but not captured or analyzed by any downstream workflow. The ReflectionCapture handler only extracts Q1-Q3.

---

### 2. "Data schema for algorithm-reflections.jsonl — fully documented"

**VERIFIED: TRUE**

Referenced in:
- `PAI/MEMORYSYSTEM.md` line 57, 140
- `PAI/SKILL.md` line 346
- `skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` lines 36-52

Schema is consistent across all references.

---

### 3. "MineReflections workflow — exists and ready to execute"

**VERIFIED: TRUE**

Location: `skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` (164 lines)

Fully specified 5-step workflow: Read reflections -> Signal prioritization -> Theme extraction (Q1/Q2/Q3) -> Synthesize upgrade candidates -> Prioritize and output. Can run standalone or as Thread 3 in the main Upgrade workflow.

---

### 4. "RatingCapture hook — captures ratings to ratings.jsonl"

**VERIFIED: TRUE**

Location: `hooks/RatingCapture.hook.ts` (22.6 KB)
Runtime data: `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl` — **745 entries** as of Mar 1, 2026.

This is the healthiest part of the pipeline. Active, generating data continuously.

---

### 5. "ReflectionCapture.ts handler — never implemented in any release"

**PARTIALLY CORRECT — critical nuance missed.**

| Check | Result |
|-------|--------|
| In `Releases/v2.3/.claude/hooks/handlers/` | NOT FOUND |
| In `Releases/v2.4/.claude/hooks/handlers/` | NOT FOUND |
| In `Releases/v2.5/.claude/hooks/handlers/` | NOT FOUND |
| In `Releases/v3.0/.claude/hooks/handlers/` | **NOT FOUND** (but imported by StopOrchestrator!) |
| In `Releases/v4.0.0/.claude/hooks/handlers/` | NOT FOUND |
| In `Releases/v4.0.1/.claude/hooks/handlers/` | NOT FOUND |
| In upstream PR #735 | YES (closed without merge) |
| In **active config** `~/.claude/hooks/handlers/` | **YES** (created Feb 20, 6.1 KB) |

**The full story:**

1. v3.0's `StopOrchestrator.hook.ts` (line 31) imports `handleReflectionCapture` from `./handlers/ReflectionCapture` and calls it (line 123)
2. But the handler was **never included in the v3.0 release directory** — it was a "ghost import"
3. The file was created locally at `~/.claude/hooks/handlers/ReflectionCapture.ts` on **Feb 20, 2026** (likely during a session that detected the gap)
4. It worked correctly while StopOrchestrator was the active Stop hook orchestrator
5. v4.0.0 (deployed Feb 27) **removed StopOrchestrator entirely**, replacing it with individual Stop hooks (LastResponseCache, ResponseTabReset, VoiceCompletion, DocIntegrity)
6. **None of the v4.0 Stop hooks import or call ReflectionCapture** — the handler is now orphaned

**The comment says "never implemented" — but it was implemented locally and was actively capturing data for 8 days.**

---

### 6. "algorithm-reflections.jsonl is never populated"

**INCORRECT.**

Runtime file: `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
- **Size:** 28.9 KB
- **Entries:** 19
- **Date range:** Feb 20 - Feb 28, 2026

Population analysis:

| Metric | Count |
|--------|-------|
| Total entries | 19 |
| Q1 populated | 9 (47%) |
| Q2 populated | 9 (47%) |
| Q3 populated | 9 (47%) |
| `learning` field populated | 19 (100%) |
| Source | All "auto-hook" |

Daily breakdown:
```
  2026-02-20: 3 entries
  2026-02-21: 1 entry
  2026-02-22: 5 entries
  2026-02-23: 3 entries
  2026-02-25: 2 entries
  2026-02-26: 2 entries
  2026-02-27: 2 entries
  2026-02-28: 1 entry    <-- last entry (StopOrchestrator removed in v4.0)
```

**The file WAS being populated, but stopped when v4.0 deployment orphaned ReflectionCapture.**

---

### 7. "MineRatings CLI tool — not found"

**VERIFIED: TRUE**

- Not found anywhere in the local codebase (all releases + active config)
- Only exists in upstream PR #735 (closed without merge, 458 lines)
- The PR describes it as a Bun CLI tool: `bun Tools/MineRatings.ts [--dry-run] [--all] [--since N]`
- Uses Haiku inference to extract "STOP doing" / "DO MORE of" recommendations from ratings data
- Supports high-water-mark tracking for incremental analysis

**Despite 745 rating entries, no tool exists to mine them for patterns.**

---

### 8. Pipeline status diagram

**VERIFIED: ACCURATE (with amendment)**

The comment's pipeline diagram:
```
Algorithm LEARN → [produces reflections] → StopHook → [MISSING: ReflectionCapture.ts] → algorithm-reflections.jsonl → MineReflections workflow
```

**Corrected diagram:**
```
Algorithm LEARN → [produces Q1-Q4 reflections in output text]
                         │
                         ├─ v3.0 (Feb 20-27): StopOrchestrator → ReflectionCapture.ts → algorithm-reflections.jsonl ✅
                         │                                                                        │
                         │                                                              MineReflections workflow ✅
                         │
                         └─ v4.0+ (Feb 27+): Individual Stop hooks → [NO HANDLER] → ❌ BROKEN
                                                                                      │
                                                                            ReflectionCapture.ts exists
                                                                            but nothing calls it

RatingCapture.hook.ts → ratings.jsonl (745 entries) → [NO TOOL: MineRatings.ts] → ❌ BROKEN
```

---

## Upstream References Verification

### PR #735

| Field | Value |
|-------|-------|
| Title | feat: add MineRatings.ts and ReflectionCapture hook — learning pipeline |
| Author | nbost130 |
| Status | **CLOSED without merge** (Feb 25, 2026) |
| Additions | +734 lines |
| Files | `Tools/MineRatings.ts`, `Releases/v3.0/.claude/hooks/ReflectionCapture.hook.ts` |

Note: PR proposed ReflectionCapture as a **standalone hook** (not a handler). The local implementation took the better architectural approach of making it a StopOrchestrator handler to avoid duplicate transcript parsing.

### Discussion #531

| Field | Value |
|-------|-------|
| Title | "Is the Learning System Actually Learning?" |
| Author | noxx |
| Status | **OPEN** (10 comments) |
| Created | Jan 29, 2026 |

Key issues raised by the community:
1. "Ratings go nowhere" — ratings captured but nothing reads them
2. "USER/ files aren't loaded" — infrastructure exists but nothing auto-loads
3. "The only skill that reads USER/ is Telos" — limited integration

This directly validates that the learning infrastructure gap is a known community concern.

---

## Fresh v4.0.2 Upstream Install: What Works and What Doesn't

**Verified against upstream `danielmiessler/Personal_AI_Infrastructure` release `Releases/v4.0.2`.**

All hooks load cleanly. No crashes. No missing imports. The system runs. But two of three learning pipelines are dead ends:

### Pipeline 1: Algorithm Reflections — DEAD END

| Step | What happens | Works? |
|------|-------------|:---:|
| Algorithm LEARN phase produces Q1-Q4 reflections in output text | `PAI/Algorithm/v3.5.0.md` lines 293-306 | YES |
| A Stop hook captures reflections → writes `algorithm-reflections.jsonl` | **No hook does this.** The 4 Stop hooks (LastResponseCache, ResponseTabReset, VoiceCompletion, DocIntegrity) don't touch reflections. No `ReflectionCapture` ships. | **NO** |
| MineReflections workflow reads JSONL, extracts patterns | `skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` ships and works | YES (but starved) |

Reflections are produced, documented, and expected — but never captured. Running "mine reflections" returns 0 entries.

### Pipeline 2: Rating Signals — DEAD END

| Step | What happens | Works? |
|------|-------------|:---:|
| User gives rating → RatingCapture writes `ratings.jsonl` | `hooks/RatingCapture.hook.ts` registered on UserPromptSubmit | YES |
| MineRatings analyzes ratings for behavioral patterns | **No such tool ships.** Not in hooks, not in Tools, not anywhere. | **NO** |

Ratings accumulate indefinitely with no consumer.

### Pipeline 3: Work Completion Learnings — WORKS

| Step | What happens | Works? |
|------|-------------|:---:|
| Session ends with significant work | `WorkCompletionLearning.hook.ts` registered on SessionEnd | YES |
| Writes markdown learning files to `MEMORY/LEARNING/` | Captures work metadata, ISC status, file changes | YES |

This pipeline is separate from Algorithm reflections and works end-to-end.

### Summary

| Pipeline | Produce | Capture | Analyze | End-to-End |
|----------|:---:|:---:|:---:|:---:|
| **Algorithm reflections** | YES | **MISSING** | YES (starved) | **DEAD END** |
| **Rating signals** | YES | YES | **MISSING** | **DEAD END** |
| **Work completion learnings** | YES | YES | N/A | **WORKS** |

### What v4.0 Dropped from v3.0 (without replacement)

v3.0 had `StopOrchestrator.hook.ts` calling 6 handlers. v4.0 replaced it with 4 independent Stop hooks. Three handler capabilities were dropped:

| Dropped Capability | What It Did | v4.0 Replacement |
|-------------------|-------------|:-:|
| **AlgorithmEnrichment** | On every Stop: extracted SLA, task description, quality gates from response → enriched algorithm state JSON | None |
| **RebuildSkill** | On every Stop: checked if `Components/` files newer than `SKILL.md` → auto-rebuilt | None |
| **ReflectionCapture** | On every Stop: extracted Q1-Q3 from LEARN phase → wrote `algorithm-reflections.jsonl` | None |

These aren't regressions from something that worked — **ReflectionCapture never shipped** (v3.0's StopOrchestrator imported it but the file wasn't included, which would crash the entire orchestrator on vanilla v3.0). AlgorithmEnrichment and RebuildSkill did ship with v3.0 but only worked on installs where someone also created the missing ReflectionCapture file.

---

## What's Missing to Complete the Pipeline (v4.0.2)

Two things need to be created. Neither exists in any release.

| Missing Piece | What It Does | Fills Which Gap |
|--------------|-------------|-----------------|
| **ReflectionCapture Stop hook** | On Stop: parse transcript, extract Q1-Q3 from LEARN phase, write JSONL | Pipeline 1: reflections produced but never captured |
| **MineRatings tool** | CLI: read `ratings.jsonl`, cluster by score, extract behavioral patterns via inference | Pipeline 2: ratings captured but never analyzed |

---

## Recommendations

### 1. Create ReflectionCapture Stop hook

Create `ReflectionCapture.hook.ts` as a standalone Stop hook (v4.0 pattern — self-contained, no orchestrator). Register in `settings.json`. On every Stop: parse transcript, look for LEARN phase Q1-Q3, write JSONL to `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`.

There is a working implementation on this local machine (`~/.claude/hooks/handlers/ReflectionCapture.ts`, 170 lines) that could serve as the basis, but it's a handler (expects to be called by StopOrchestrator) not a standalone hook — it would need the transcript parsing wrapper added.

### 2. Create MineRatings tool

CLI tool: `bun Tools/MineRatings.ts`. Reads `ratings.jsonl`, clusters by score band, uses Haiku inference to extract behavioral patterns, produces "STOP doing" / "DO MORE of" recommendations. The closed upstream PR #735 has a 458-line reference implementation.

---

## Upstream Evidence: This Is a Known, Persistent Gap

Searched all issues, PRs, discussions, commits, and code comments in `danielmiessler/Personal_AI_Infrastructure` for references to the learning pipeline gap. Found **28 references** spanning Jan 3 – Mar 1, 2026.

### Daniel Miessler confirmed the gap

Discussion #531 (Jan 29), Daniel responded (Jan 30):

> *"Yes, the final piece of applying the learnings and doing the matching is not happening natively. It's just all the pieces are set up there for it to happen... a final piece is needed to close the loop. We'll be adding that very soon."*

He later claimed v3.0 fixed it (Feb 18) via MineReflections and AlgorithmUpgrade workflows. Community member @wojteksbt immediately reported (Feb 20): *"Since v3.0 migration I have zero spontaneous reflection entries in algorithm-reflections.jsonl."*

### Three PRs attempted to fix it — all closed without merge

| PR | Title | Date | Status |
|----|-------|------|--------|
| [#404](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/404) | feat: Add learning capture and pre-flight check system | Jan 14 | Closed (Feb 10) |
| [#733](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/733) | feat: add MineRatings.ts — mine ratings for behavioral patterns | Feb 18 | Closed (Feb 19, superseded by #735) |
| [#735](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/735) | feat: add MineRatings.ts and ReflectionCapture hook — learning pipeline | Feb 19 | Closed (Feb 25, no merge, no comments explaining why) |

PR #760 (Algorithm v1.8.1) explicitly stated it was *"a direct result of #735 (learning pipeline)"* and showed the feedback loop working — also closed without merge.

### Only one fix was merged

[PR #703](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/703) (Feb 16, merged Feb 17): Fixed threshold bug where neutral 5/10 ratings created noise learning files. Plus v4.0.2 fixed the explicit rating `source` field (Issue #772). These improved data quality but didn't close the loop.

### The pipeline runner itself is a TODO

`PAI/ACTIONS/pai.ts` across all releases (v3.0, v4.0.0, v4.0.1, v4.0.2):
```typescript
// TODO: Implement pipeline runner
console.error('Pipeline execution not yet implemented: ${target}');
```

### Key upstream discussions

| # | Title | Date | State | Summary |
|---|-------|------|-------|---------|
| [305](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/305) | History injection is missing | Jan 3 | Open | First signal: history never re-injected |
| [530](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/530) | PAI Acknowledges But Doesn't Change | Jan 28 | Resolved | Feedback lost across sessions |
| [**531**](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/531) | **Is the Learning System Actually Learning?** | Jan 29 | **Open** | Canonical thread. Daniel confirms gap. |
| [527](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/527) | PAI Memory System [v0.2] | Jan 28 | Resolved | Comprehensive memory architecture proposal |
| [632](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/632) | Closing the Learning Loop | Feb 10 | Resolved | 3-level proposal; Daniel pointed to v3.0 |
| [693](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/693) | Interim workaround: steering rules | Feb 16 | Resolved | Community workaround for write-only learning |
| [828](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/828) | v4.0 behavioral regression | Feb 28 | Open | Algorithm mode rarely activates in v4.0, so LEARN phase (where reflections come from) rarely runs |

### Key upstream issues

| # | Title | Date | State | Summary |
|---|-------|------|-------|---------|
| [362](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/362) | metadata-extraction.ts lost in rebrand | Jan 9 | Closed | Memory capture broken by rebranding |
| [372](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/372) | 4 memory hooks deleted, not migrated | Jan 10 | Closed | v2.1.1 deleted hooks without migration |
| [417](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/417) | StopOrchestrator missing TranscriptParser | Jan 17 | Closed | Fresh install: StopOrchestrator crashes |
| [700](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/700) | PRD persistence skipped during Algorithm | Feb 16 | Open | Reflections don't persist; cross-refs #531 |
| [772](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/772) | Explicit ratings missing source field | Feb 22 | Closed (v4.0.2) | Explicit ratings invisible to learning system |
| [844](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/844) | MEMORY/RESEARCH/ never implemented | Mar 1 | Open | Same pattern: documented but write path broken |

### Pattern

The learning pipeline gap has been reported from **6+ independent angles** since Jan 2026. The maintainer acknowledged it, claimed v3.0 fixed it, but the community confirmed it's still broken. Three community PRs attempted to close it — all rejected without explanation. The gap persists in v4.0.2.

---

*Report generated 2026-03-01 by PAI analysis of upstream danielmiessler/Personal_AI_Infrastructure and local fork virtualian/pai.*
