---
name: learn
description: Closed-loop behavioural improvement — mine signals, synthesise patterns, propose changes, review, apply. USE WHEN learn, learn check, learn review, learn apply, mine reflections, mine ratings, algorithm upgrade, improve the algorithm, what have we learned, internal improvements, close the loop, learning synthesis, learning status, check signals, what's happening, review proposals, what should change, apply changes, apply proposals.
---

## Customization

**Before executing, check for user customizations at:**
`~/.pai/PAI/USER/SKILLCUSTOMIZATIONS/Learning/`

If this directory exists, load and apply any PREFERENCES.md, configurations,
or resources found there. These override default behavior. If the directory
does not exist, proceed with skill defaults.

## Voice Notification

**When executing a workflow, announce via Notify.ts:**

```bash
bun ~/.pai/PAI/Tools/Notify.ts "Running the WORKFLOWNAME workflow in the Learning skill to ACTION"
```

Then output text notification:
```
Running the **WorkflowName** workflow in the **Learning** skill to ACTION...
```

# Learning Skill

**Purpose:** Closed-loop behavioural improvement pipeline. Records activity, extracts signals,
synthesises patterns, proposes changes, enables human review, and applies approved changes
to three targets: Algorithm spec, AISTEERINGRULES.md, and feedback memories.

**Architecture:**

```
  Capture Layer (hooks)              Analysis + Action Layer (this skill)
  ┌──────────────────────┐     ┌──────────────────────────────────────────────┐
  │ RatingCapture.hook   │     │                                              │
  │ WorkCompletion.hook  │     │  /learn check     /learn review  /learn apply│
  │ LoadContext.hook     │     │  ┌──────────┐     ┌──────────┐  ┌──────────┐│
  │ learning-readback    │     │  │ 1. Mine  │     │3. Propose│  │5. Apply  ││
  │                      │     │  │ 2. Synth │     │4. Review │  │  (2-gate)││
  └──────────┬───────────┘     │  └────┬─────┘     └────┬─────┘  └────┬─────┘│
             │                 │       │                │              │      │
             v                 │       v                v              v      │
       MEMORY/LEARNING/        │  mine-output.md   review.md    Algorithm    │
       (ratings.jsonl,         │  last-synthesis.md              STEERING     │
        reflections.jsonl)     │                                 Memories     │
                               └──────────────────────────────────────────────┘
```

## Commands

| Command | Action | Workflow |
|---------|--------|----------|
| `/learn check` | Mine signals, synthesise patterns, print summary | `Workflows/Check.md` |
| `/learn review` | Generate/update proposals, open review file | `Workflows/Review.md` |
| `/learn apply` | Stage diffs for accepted proposals, apply after review | `Workflows/Apply.md` |

## Workflow Routing

| Trigger | Route |
|---------|-------|
| "learn check", "check signals", "what's happening", "close the loop", "learning synthesis", "what have we learned", "mine reflections", "mine ratings" | `Workflows/Check.md` |
| "learn review", "review proposals", "what should change", "algorithm upgrade", "improve the algorithm" | `Workflows/Review.md` |
| "learn apply", "apply changes", "apply proposals" | `Workflows/Apply.md` |

**Default:** If user says "learn" without a subcommand, show status (see below).

## Status Display (bare `/learn`)

When invoked with no subcommand, display pipeline status:

1. **Check status:** Read `~/.pai/MEMORY/LEARNING/last-synthesis.md` frontmatter for `generated` timestamp. Report when check last ran.
2. **Proposal counts:** Read `~/.pai/MEMORY/LEARNING/review.md` if it exists. Count proposals by status (PENDING, ACCEPTED, DEFERRED, REJECTED, APPLIED).
3. **Unprocessed signals:** Compare the `generated` timestamp from last-synthesis.md against the modification times of `ratings.jsonl` and `algorithm-reflections.jsonl`. If signals are newer than the last synthesis, report "Unprocessed signals exist since last check."

Output format:
```
## Learning Pipeline Status

**Last check:** [timestamp or "never"]
**Proposals:** [N] pending | [N] accepted | [N] deferred | [N] applied
**Unprocessed signals:** [yes/no — signals newer than last synthesis]

Next steps:
- `/learn check` to mine and synthesise new signals
- `/learn review` to generate or update proposals
- `/learn apply` to apply accepted proposals
```

## Data Sources

| Source | Location (runtime) | Writer | Content |
|--------|----------|--------|---------|
| Algorithm reflections | `~/.pai/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` | Algorithm LEARN phase | Q1/Q2/Q3 reflections per session |
| User ratings | `~/.pai/MEMORY/LEARNING/SIGNALS/ratings.jsonl` | RatingCapture.hook.ts | Explicit + implicit ratings with sentiment |
| HWM state | `~/.pai/MEMORY/LEARNING/SIGNALS/mine-ratings-hwm.json` | MineRatings.ts | Last-processed timestamp for incremental analysis |

## Pipeline Output Files

| File | Writer | Content | Persistence |
|------|--------|---------|-------------|
| `MEMORY/LEARNING/mine-output.md` | Check workflow | Raw mining results | Replaced each run |
| `MEMORY/LEARNING/last-synthesis.md` | Check workflow | Cross-referenced synthesis | Replaced each run |
| `MEMORY/LEARNING/review.md` | Review workflow + human | Proposals with lifecycle status | Persistent, accumulates |
| `MEMORY/LEARNING/staged-changes.md` | Apply workflow | Diffs with checkboxes | Transient, deleted after apply |
| `MEMORY/LEARNING/digest.md` | Human (manual compaction) | Compressed signal history | Persistent |

## Tool Reference

| Tool | Purpose |
|------|---------|
| `Tools/MineRatings.ts` | Behavioral pattern analysis from ratings (CLI tool, uses Inference.ts) |

## Cross-Skill Integration

The **PAIUpgrade** skill's Upgrade workflow calls the Learning skill's Check workflow
as Thread 3 to include internal signals alongside external discoveries:

```
PAIUpgrade Upgrade workflow:
  Thread 1: User Context      (own agents)
  Thread 2: Source Collection  (own agents)
  Thread 3: Internal Signals   (calls Learning/Check or reads last-synthesis.md)
```
