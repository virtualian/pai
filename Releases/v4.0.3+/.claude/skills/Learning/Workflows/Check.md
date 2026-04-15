# Check Workflow (Mine + Synthesise)

Running the **Check** workflow in the **Learning** skill to mine and synthesise learning signals...

**Mines reflections and ratings in parallel, cross-references them, and writes synthesis files for downstream workflows.**

**Trigger:** "learn check", "check signals", "what's happening", "close the loop", "learning synthesis", "what have we learned", "mine reflections", "mine ratings"

---

## Overview

This is the analytical engine of the Learning pipeline. It runs both mining operations in parallel, cross-references the results, and writes structured output files that the Review workflow consumes.

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
            │  Cross-Reference     │
            │  (correlate themes   │
            │   with ratings)      │
            └──────────┬───────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
     mine-output.md        last-synthesis.md
     (raw results)         (cross-referenced)
```

---

## Signal Prioritization Weights

**Not all signals are equally valuable.** Weight entries by signal strength:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| `implied_sentiment` <= 5 | HIGH | Low satisfaction = something went wrong worth fixing |
| `implied_sentiment` 6-7 | MEDIUM | Room for improvement |
| `implied_sentiment` 8-10 | LOW | Things went well — less urgent |
| `within_budget: false` | BOOST | Over-budget = structural issue |
| `criteria_failed > 0` | BOOST | Failed criteria = verification gap |
| `rework_count > 0` | BOOST | Rework = initial approach was wrong |

**Highest signal entries:** Low sentiment + substantive Q2 answer + over-budget. These are the gold.

---

## Execution

### Step 1: Check for Digest (Compressed History)

```
Check if ~/.pai/MEMORY/LEARNING/digest.md exists.

If it exists:
  - Read the digest file
  - Extract the `covers` field from frontmatter (date range)
  - This digest summarises all signals older than its coverage date
  - Only raw signals AFTER the digest coverage date need full processing
  - Pass the digest content to both miners as additional context

If it does not exist:
  - Process all raw signals (full dataset)
  - This is normal for systems that haven't run compaction yet
```

### Step 2: Launch Parallel Miners

Spawn 2 agents in parallel:

```
Use Agent tool, run 2 agents in parallel:

Agent - Reflection Miner:
"Mine internal algorithm reflections for recurring improvement patterns.

Read ~/.pai/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
Parse each line as JSON.

[IF DIGEST EXISTS, prepend this to the prompt:]
COMPRESSED HISTORY (digest covering [date range]):
[digest content]
Only process raw entries AFTER [digest end date]. The digest already summarises older patterns.
[END DIGEST SECTION]

Signal prioritization:
- implied_sentiment <= 5 → HIGH signal
- implied_sentiment 6-7 → MEDIUM signal
- implied_sentiment 8-10 → LOW signal
- within_budget: false → BOOST weight
- criteria_failed > 0 → BOOST weight
- rework_count > 0 → BOOST weight

Analysis steps:
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

Read ~/.pai/MEMORY/LEARNING/SIGNALS/ratings.jsonl
Parse each line as JSON.

[IF DIGEST EXISTS, prepend this to the prompt:]
COMPRESSED HISTORY (digest covering [date range]):
[digest content]
Only process raw entries AFTER [digest end date]. The digest already summarises older patterns.
[END DIGEST SECTION]

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

### Step 3: Collect Results

Wait for both agents to complete. Collect their outputs.

### Step 4: Cross-Reference Reflections x Ratings

Where reflection themes correlate with rating patterns, note the reinforcement:
- A reflection theme about "over-budget phases" + low ratings on long sessions = high-confidence signal
- An explicit rating comment matching a Q2 reflection theme = strongest possible signal
- A STOP pattern from ratings matching an execution warning from reflections = cross-validated

For each cross-referenced pair, assign severity:
- **CRITICAL:** Cross-referenced between both sources, 5+ total occurrences
- **HIGH:** Cross-referenced between both sources, 2-4 occurrences, OR single source 8+ occurrences with HIGH signal
- **MODERATE:** Single source, 3-7 occurrences

### Step 5: Write mine-output.md (Raw Mining Results)

```
Write the raw mining results to:
~/.pai/MEMORY/LEARNING/mine-output.md

With YAML frontmatter:
---
stage: mine
ran_at: [ISO timestamp]
pipeline_version: 1.0.0
input_files:
  - MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
  - MEMORY/LEARNING/SIGNALS/ratings.jsonl
reflections_analyzed: [N]
ratings_analyzed: [N]
digest_used: [true/false]
---

Body contains the raw output from both miners, separated by headers:
## Reflection Mining Results
[Reflection miner output]

## Ratings Mining Results
[Ratings miner output]
```

### Step 6: Write last-synthesis.md (Cross-Referenced Synthesis)

```
Write the cross-referenced synthesis to:
~/.pai/MEMORY/LEARNING/last-synthesis.md

With YAML frontmatter:
---
stage: synthesise
generated: [ISO timestamp]
pipeline_version: 1.0.0
reflections_analyzed: [N]
ratings_analyzed: [N]
upgrade_candidates: [N]
cross_referenced: true
---

Body contains the Internal Signals report:

## Internal Signals

Upgrade candidates mined from algorithm reflections and user ratings.
Cross-referenced: where low ratings correlate with reflection themes, both signals reinforce priority.

### Algorithm Reflections

**Source:** ~/.pai/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
**Entries analyzed:** [N] | **High-signal:** [N]

[For each upgrade candidate:]
#### [Theme Name] ([N] occurrences, [CRITICAL/HIGH/MODERATE] severity)
**Root cause:** [structural issue]
**Proposed fix:** [concrete change]
**Target:** [PAI files affected]
**Evidence:**
- [timestamp] [task] — "[Q2 quote]"

### Behavioral Signals from Ratings

**Source:** ~/.pai/MEMORY/LEARNING/SIGNALS/ratings.jsonl
**Entries analyzed:** [N] | **Explicit feedback:** [N] | **Problem sessions:** [N]

#### STOP (Low-Rating Patterns)
- **[Pattern]** (seen [N] times, avg rating [N]) — [examples]

#### DO MORE (High-Rating Patterns)
- **[Pattern]** (seen [N] times, avg rating [N]) — [examples]

### Cross-Referenced Signals
[Signals that appear in BOTH reflections and ratings, with combined evidence]
```

### Step 7: Print Summary to Conversation

After writing both files, output a summary:

```
## Learning Check Complete

**Reflections analyzed:** [N] entries
**Ratings analyzed:** [N] entries
**Upgrade candidates:** [N] ([N] critical, [N] high, [N] moderate)
**Cross-referenced signals:** [N] (appear in both reflections and ratings)

**Top candidates:**
1. [Theme] — [severity], [N] occurrences
2. [Theme] — [severity], [N] occurrences
3. [Theme] — [severity], [N] occurrences

**Files written:**
- `MEMORY/LEARNING/mine-output.md` (raw mining results)
- `MEMORY/LEARNING/last-synthesis.md` (cross-referenced synthesis)

**Next step:** Run `/learn review` to generate change proposals from these signals.
```

---

## Integration

- **Standalone:** User says "learn check" or "close the loop"
- **From Review:** The Review workflow auto-runs Check if synthesis is stale (> 24h)
- **From PAIUpgrade:** The Upgrade workflow's Thread 3 reads `last-synthesis.md` or delegates to this workflow
