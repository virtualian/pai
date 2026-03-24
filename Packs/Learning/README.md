---
name: Learning
pack-id: pai-learning-v1.0.0
version: 1.0.0
author: pai
description: Closed-loop behavioural improvement — mine signals, synthesise patterns, propose changes, review, apply
type: skill
purpose-type: [learning, self-improvement, behavioral-analysis]
platform: claude-code
dependencies: []
keywords: [learning, self-improvement, algorithm-upgrade, behavioral-analysis, ratings, reflections, feedback-loop]
---

# Learning

> Closed-loop behavioural improvement -- from raw signals to applied changes, all behind three commands.

---

## The Problem

PAI captures learning signals in two places -- algorithm reflections after every run, and user ratings on every prompt. But these signals sit in JSONL files with no automated path to action. The four existing workflows don't pass data to each other, two downstream targets (AISTEERINGRULES.md, feedback memories) have no automated learning path, and there's no mechanism for accumulating and reviewing proposed changes over time.

The fundamental issue: learning signals accumulate but never close the loop.

---

## The Solution

The Learning skill provides a unified 5-stage pipeline behind 3 commands:

```
/learn check    -- What's happening? Run analysis, print summary.
/learn review   -- What should change? Generate/update review file, open it.
/learn apply    -- Do it. Stage diffs for accepted proposals, apply.
```

`/learn` with no argument shows current status: when check last ran, how many pending/deferred/accepted proposals, whether unprocessed signals exist since last check.

### Pipeline Stages

```
  Capture (hooks)         Analysis (this skill)            Action
  ┌──────────────┐     ┌──────────────────────────────────────────────────┐
  │ RatingCapture│     │ 1. Mine ─── extract raw signals                 │
  │ WorkCompletion│    │ 2. Synthesise ── cross-reference, prioritise    │
  │ LoadContext  │     │ 3. Propose ── generate change proposals         │
  │ learning-    │     │ 4. Review ── human edits status fields          │
  │   readback   │     │ 5. Apply ── two-gate approval, write changes   │
  └──────┬───────┘     └──────────────────────────┬───────────────────────┘
         │                                        │
         v                                        v
   MEMORY/LEARNING/                     Algorithm spec
   (ratings.jsonl,                      AISTEERINGRULES.md
    reflections.jsonl)                  Feedback memories
```

### Proposal Lifecycle

```
[generated] --> [PENDING]
[PENDING]   --> [ACCEPTED] | [DEFERRED] | [REJECTED]
[ACCEPTED]  --> [APPLIED]  (only after staged diff checked by human)
[DEFERRED]  --> [ACCEPTED] | [REJECTED]  (on next review)
[REJECTED]  --> resurfaces only if signal strengthens
```

Two gates before any change is written: ACCEPTED in the review file (intent), then checkbox checked in the staged changes file (concrete diff).

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Routing, trigger words, status display |
| Check workflow | `src/Workflows/Check.md` | Mine + Synthesise (parallel miners, cross-reference) |
| Review workflow | `src/Workflows/Review.md` | Propose + open review file |
| Apply workflow | `src/Workflows/Apply.md` | Two-gate approval and change application |
| MineRatings tool | `src/Tools/MineRatings.ts` | Behavioral pattern analysis from ratings (CLI) |

**Summary:**
- **Workflows:** 3 (Check, Review, Apply)
- **Tools:** 1 (MineRatings.ts)
- **Dependencies:** None (uses PAI Inference.ts for ratings analysis)

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "learn check" | Mines reflections + ratings in parallel, cross-references, writes synthesis |
| "learn review" | Generates proposals from synthesis, writes/updates review.md |
| "learn apply" | Stages diffs for accepted proposals, applies after human review |
| "learn" (bare) | Shows status: last check time, proposal counts, unprocessed signals |
| "close the loop" | Routes to Check workflow |
| "algorithm upgrade" | Routes to Review workflow (generates Algorithm-targeted proposals) |
| "what have we learned" | Routes to Check workflow |

---

## Data Flow

| Source | Location | Writer | Content |
|--------|----------|--------|---------|
| Algorithm reflections | `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` | Algorithm LEARN phase | Q1/Q2/Q3 reflections per session |
| User ratings | `MEMORY/LEARNING/SIGNALS/ratings.jsonl` | RatingCapture.hook.ts | Explicit + implicit ratings |
| Mine output | `MEMORY/LEARNING/mine-output.md` | Check workflow | Raw mining results |
| Synthesis | `MEMORY/LEARNING/last-synthesis.md` | Check workflow | Cross-referenced analysis |
| Review file | `MEMORY/LEARNING/review.md` | Review workflow + human | Proposals with status |
| Staged changes | `MEMORY/LEARNING/staged-changes.md` | Apply workflow (transient) | Diffs with checkboxes |

---

## Changelog

### 1.0.0 - 2026-03-22
- Initial release as standalone pack (promoted from Utilities sub-skill)
- Unified 5-stage pipeline: Mine, Synthesise, Propose, Review, Apply
- Three commands: /learn check, /learn review, /learn apply
- Three targets: Algorithm spec, AISTEERINGRULES.md, feedback memories
- LP-xxx proposal numbering with lifecycle tracking
- Two-gate approval (intent + concrete diff)
- Digest support for compressed signal history
