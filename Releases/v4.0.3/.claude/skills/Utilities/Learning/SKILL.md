---
name: Learning
description: Analyze PAI's internal learning signals for behavioral improvements and Algorithm upgrades. USE WHEN mine reflections, mine ratings, algorithm upgrade, improve the algorithm, what have we learned, internal improvements, reflection insights, behavioral patterns, learning analysis, learning synthesis, close the loop.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Learning/`

If this directory exists, load and apply any PREFERENCES.md, configurations,
or resources found there. These override default behavior. If the directory
does not exist, proceed with skill defaults.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Learning skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Learning** skill to ACTION...
   ```

# Learning Skill

**Purpose:** Analyze PAI's accumulated learning signals (algorithm reflections,
user ratings) to identify behavioral patterns, propose Algorithm improvements,
and close the learning loop.

**Architecture:**

```
Capture Layer (hooks)          Analysis Layer (this skill)
  RatingCapture.hook.ts          MineReflections workflow  ← LEAF (reads JSONL)
  WorkCompletionLearning.hook.ts MineRatings workflow      ← LEAF (calls MineRatings.ts CLI)
  LoadContext.hook.ts            Synthesize workflow        ← calls MineReflections + MineRatings.ts
  learning-readback.ts           AlgorithmUpgrade workflow  ← calls MineReflections + maps to spec
           |                              |
           v                              v
     MEMORY/LEARNING/              Actionable patterns,
     (ratings.jsonl,               Algorithm upgrade proposals,
      reflections.jsonl)           STOP/DO MORE rules
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **MineReflections** | "mine reflections", "check reflections", "what have we learned", "internal improvements", "reflection insights" | `Workflows/MineReflections.md` |
| **MineRatings** | "mine ratings", "analyze ratings", "behavioral patterns", "what to stop", "what to do more" | `Workflows/MineRatings.md` |
| **AlgorithmUpgrade** | "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "fix the algorithm" | `Workflows/AlgorithmUpgrade.md` |
| **Synthesize** | "learning synthesis", "internal signals", "close the loop", "full learning analysis" | `Workflows/Synthesize.md` |

**Default workflow:** If user says "mine" or "learning" without specifics,
run the **Synthesize** workflow.

## Data Sources

| Source | Location (runtime) | Writer | Content |
|--------|----------|--------|---------|
| Algorithm reflections | `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` | Algorithm LEARN phase | Q1/Q2/Q3 reflections per session |
| User ratings | `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl` | RatingCapture.hook.ts | Explicit + implicit ratings with sentiment |
| HWM state | `~/.claude/MEMORY/LEARNING/SIGNALS/mine-ratings-hwm.json` | MineRatings.ts | Last-processed timestamp for incremental analysis |

## Tool Reference

| Tool | Purpose |
|------|---------|
| `Tools/MineRatings.ts` | Behavioral pattern analysis from ratings (CLI tool) |

## Examples

**Example 1: Mine reflections for patterns**
```
User: "mine reflections"
-> Invokes MineReflections workflow
-> Reads algorithm-reflections.jsonl
-> Clusters Q2 themes, weights by sentiment/budget
-> Outputs upgrade candidates with evidence
```

**Example 2: Behavioral analysis from ratings**
```
User: "mine ratings"
-> Invokes MineRatings workflow
-> Runs Tools/MineRatings.ts
-> Groups by session, identifies STOP/DO MORE patterns
-> Outputs behavioral recommendations
```

**Example 3: Full learning synthesis**
```
User: "close the learning loop"
-> Invokes Synthesize workflow
-> Runs MineReflections + MineRatings in parallel
-> Cross-references reflection themes with rating patterns
-> Outputs combined Internal Signals report
```

## Cross-Skill Integration

The **PAIUpgrade** skill's Upgrade workflow calls the **Synthesize** workflow
as Thread 3 to include internal signals alongside external discoveries:

```
PAIUpgrade Upgrade workflow:
  Thread 1: User Context      (own agents)
  Thread 2: Source Collection  (own agents)
  Thread 3: Internal Signals   (calls Learning/Synthesize)
```
