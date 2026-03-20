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
┌─────────────────────┐     ┌──────────────────────┐
│  Reflection Miner   │     │   Ratings Miner      │
│  (algorithm-        │     │   (ratings.jsonl)     │
│   reflections.jsonl)│     │                      │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          └──────────┬─────────────────┘
                     ▼
          ┌──────────────────────┐
          │  Combined Internal   │
          │  Signals Report      │
          └──────────────────────┘
```

---

## Execution

### Step 1: Launch Parallel Miners

Spawn 2 agents in parallel:

```
Use Task tool with subagent_type=general-purpose, run 2 agents in parallel:

Agent - Reflection Miner:
"Mine internal algorithm reflections for recurring improvement patterns.

Read ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
Parse each line as JSON. For the full MineReflections methodology, see ~/.claude/skills/Utilities/Learning/Workflows/MineReflections.md.

Quick summary of what to do:
1. Read all entries from the JSONL file
2. Prioritize entries with implied_sentiment <= 5, within_budget: false, or criteria_failed > 0
3. Cluster Q2 answers (algorithm improvements) into themes by similarity
4. Cluster Q1 answers (execution patterns) into themes
5. For themes with 2+ occurrences (or 1 if sentiment <= 4), create upgrade candidates

Return format:
{
  'entries_analyzed': N,
  'date_range': '[earliest] to [latest]',
  'upgrade_candidates': [
    {
      'theme': '[Theme name]',
      'frequency': N,
      'signal': 'HIGH/MEDIUM/LOW',
      'root_cause': '[Structural issue]',
      'proposed_fix': '[What to change]',
      'target_files': ['[paths]'],
      'supporting_quotes': ['[Q2 excerpts]']
    }
  ],
  'execution_warnings': ['[Recurring Q1 mistakes]'],
  'aspirational_insights': ['[Q3 patterns]']
}

If the reflections file doesn't exist or is empty, return:
{ 'entries_analyzed': 0, 'note': 'No reflections found yet — reflections accumulate after Standard+ Algorithm runs' }

EFFORT LEVEL: Return within 60 seconds."

Agent - Ratings Miner:
"Mine user ratings for behavioral patterns — what to STOP doing and what to DO MORE of.

Read ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl
Parse each line as JSON.

Analysis steps:
1. Group entries by session_id, compute per-session average rating
2. Identify sessions with average rating <= 4 (problem sessions)
3. Extract ALL explicit feedback (source='explicit') — these are highest signal
4. Cluster sentiment_summary text from low-rated entries (rating <= 4) for patterns
5. Cluster sentiment_summary text from high-rated entries (rating >= 8) for positive patterns

Return format:
{
  'entries_analyzed': N,
  'date_range': '[earliest] to [latest]',
  'explicit_feedback': [
    { 'timestamp': '...', 'rating': N, 'comment': '...', 'response_preview': '...' }
  ],
  'stop_patterns': [
    { 'pattern': '[behavior to stop]', 'frequency': N, 'avg_rating': N, 'examples': ['...'] }
  ],
  'do_more_patterns': [
    { 'pattern': '[behavior to continue]', 'frequency': N, 'avg_rating': N, 'examples': ['...'] }
  ],
  'problem_sessions': [
    { 'session_id': '...', 'avg_rating': N, 'entry_count': N, 'themes': ['...'] }
  ]
}

If the ratings file doesn't exist or is empty, return:
{ 'entries_analyzed': 0, 'note': 'No ratings found yet' }

EFFORT LEVEL: Return within 60 seconds."
```

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

### Step 5: Save Report for Downstream Workflows

After outputting the report to the conversation, also write it to a known location so downstream workflows (e.g., AlgorithmUpgrade) can consume it without re-mining:

```
Write the complete Internal Signals report (from Step 4) to:
~/.claude/MEMORY/LEARNING/last-synthesis.md

Prepend YAML frontmatter with metadata:
---
generated: [ISO timestamp]
reflections_analyzed: [N]
ratings_analyzed: [N]
upgrade_candidates: [N]
cross_referenced: true
---

The rest of the file is the full Internal Signals report as output in Step 4.
```

This file is the handoff mechanism to AlgorithmUpgrade and any other workflow that benefits from pre-computed synthesis results.

---

## Integration

- **Standalone:** User says "close the loop" or "internal signals"
- **From PAIUpgrade:** The Upgrade workflow delegates Thread 3 to this workflow. The output slots directly into the Upgrade report's "Internal Signals" section.
- **To AlgorithmUpgrade:** Writes `last-synthesis.md` which AlgorithmUpgrade reads instead of re-mining reflections. This preserves the cross-referenced ratings signal that AlgorithmUpgrade would otherwise lose.
