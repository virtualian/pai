# MineRatings Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the MineRatings workflow in the Learning skill to analyze behavioral patterns from ratings"}' \
  > /dev/null 2>&1 &
```

Running the **MineRatings** workflow in the **Learning** skill to analyze behavioral patterns from ratings...

**Analyzes user ratings for behavioral patterns — what to STOP doing and what to DO MORE of.**

**Trigger:** "mine ratings", "analyze ratings", "behavioral patterns", "what to stop", "what to do more"

---

## Overview

The RatingCapture hook captures explicit and implicit ratings to `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl` on every user prompt. This workflow runs the MineRatings CLI tool to analyze those ratings for behavioral patterns.

The tool uses high-water-mark (HWM) tracking to process only new entries by default, with `--all` to reprocess everything.

---

## Execution

### Step 1: Run MineRatings Tool

```bash
bun ~/.claude/skills/Utilities/Learning/Tools/MineRatings.ts
```

For a full reprocessing of all entries:

```bash
bun ~/.claude/skills/Utilities/Learning/Tools/MineRatings.ts --all
```

### Step 2: Review Output

The tool produces a structured report with:

- **STOP** — Behaviors correlating with low ratings (<=4)
- **DO MORE** — Behaviors correlating with high ratings (>=8)
- **EXPLICIT FEEDBACK** — User's own words, grouped by theme
- **SESSION PATTERNS** — Sessions that went well or poorly
- **CONFIDENCE NOTES** — Patterns in confidence scores

### Step 3: Present Results

Display the tool's output directly. The inference-based synthesis is the final product.

---

## Integration

- **Standalone:** User says "mine ratings" or "analyze ratings"
- **As part of Synthesize:** The Synthesize workflow calls `bun MineRatings.ts --all` directly in parallel with MineReflections
- **As Thread 3 in PAIUpgrade:** Via the Synthesize workflow
