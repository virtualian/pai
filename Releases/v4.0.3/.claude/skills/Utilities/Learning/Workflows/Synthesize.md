# Synthesize Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Synthesize workflow in the Learning skill to produce combined internal signals report"}' \
  > /dev/null 2>&1 &
```

Running the **Synthesize** workflow in the **Learning** skill to produce combined internal signals...

**Runs MineReflections and MineRatings analysis in parallel and produces a combined Internal Signals report.**

**Trigger:** "learning synthesis", "internal signals", "close the loop", "full learning analysis"

---

## Overview

This is the default Learning skill workflow. It runs both mining pipelines in parallel and produces a unified report suitable for standalone use or consumption by the PAIUpgrade Upgrade workflow (Thread 3).

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  MineReflections.md     │     │   MineRatings.ts CLI    │
│  (workflow delegation)  │     │   (bun Tools/MineRatings│
│                         │     │    .ts --all)           │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
             ┌──────────────────────┐
             │  Combined Internal   │
             │  Signals Report      │
             └──────────────────────┘
```

---

## Execution

### Step 1: Launch Parallel Miners

Run both mining pipelines in parallel:

**Reflection Miner** — Spawn 1 agent:

```
Use Task tool with subagent_type=general-purpose:

"Mine internal algorithm reflections by following the MineReflections workflow.

Read and execute the methodology in ~/.claude/skills/Utilities/Learning/Workflows/MineReflections.md exactly.
That workflow specifies the data source, signal prioritization, theme extraction, and output format.

If the reflections file doesn't exist or is empty, return:
{ 'entries_analyzed': 0, 'note': 'No reflections found yet — reflections accumulate after Standard+ Algorithm runs' }

EFFORT LEVEL: Return within 60 seconds."
```

**Ratings Miner** — Run the MineRatings CLI tool directly (no agent needed):

```bash
bun ~/.claude/skills/Utilities/Learning/Tools/MineRatings.ts --all
```

This runs the full ratings analysis pipeline including inference-based STOP/DO MORE synthesis. The `--all` flag ensures full reprocessing for a complete synthesis report. On success, the tool updates the HWM for future incremental runs.

### Step 2: Collect and Combine Results

Wait for both agents to complete. Collect their outputs.

### Step 3: Cross-Reference

Where reflection themes correlate with rating patterns, note the reinforcement:
- A reflection theme about "over-budget phases" + low ratings on long sessions = high-confidence signal
- An explicit rating comment matching a Q2 reflection theme = strongest possible signal

### Step 4: Output Combined Report

Generate the Internal Signals report in this format:

```markdown
## Internal Signals

Upgrade candidates mined from our own algorithm reflections and user ratings. These are recurring patterns in what went wrong or could be improved, based on post-algorithm self-reflection and behavioral signals from ratings.

**Cross-reference:** Where low ratings correlate with reflection themes, both signals reinforce the upgrade priority.

### Algorithm Reflections

**Source:** ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
**Entries analyzed:** [N] | **High-signal:** [N] (low sentiment, over-budget, or failed criteria)

[For each upgrade candidate from the reflection miner:]

#### [Theme Name] ([N] occurrences, [HIGH/MEDIUM/LOW] signal)
**Root cause:** [What structural issue drives this pattern]
**Proposed fix:** [Concrete change]
**Target:** [PAI files affected]
**Evidence:**
- [timestamp] [task] — "[Q2 quote]"

[If no reflections exist yet:]
> No reflections found yet — they accumulate after Standard+ Algorithm runs. Run the Algorithm a few more times and this section will populate.

### Behavioral Signals from Ratings

**Source:** ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl
**Entries analyzed:** [N] | **Explicit feedback:** [N] | **Problem sessions:** [N]

#### STOP (Low-Rating Patterns)
[For each stop_pattern:]
- **[Pattern]** (seen [N] times, avg rating [N]) — [example sentiment summaries]

#### DO MORE (High-Rating Patterns)
[For each do_more_pattern:]
- **[Pattern]** (seen [N] times, avg rating [N]) — [example sentiment summaries]

#### Explicit User Feedback
[For each explicit_feedback entry:]
- [[timestamp]] Rating [N]/10: "[comment excerpt]"

[If no ratings exist yet:]
> No ratings found yet — they accumulate from the RatingCapture hook during conversations.
```

---

## Integration

- **Standalone:** User says "close the loop" or "internal signals"
- **From PAIUpgrade:** The Upgrade workflow delegates Thread 3 to this workflow. The output slots directly into the Upgrade report's "Internal Signals" section.
