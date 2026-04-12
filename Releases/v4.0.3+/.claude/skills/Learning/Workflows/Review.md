# Review Workflow (Propose + Open Review File)

```bash
bun ~/.pai/PAI/Tools/Notify.ts "Running the Review workflow in the Learning skill to generate change proposals"
```

Running the **Review** workflow in the **Learning** skill to generate change proposals...

**Generates concrete change proposals from synthesis results, writes/updates review.md for human review.**

**Trigger:** "learn review", "review proposals", "what should change", "algorithm upgrade", "improve the algorithm"

---

## Overview

This workflow is the decision bridge between analysis (Check) and action (Apply). It reads synthesised signals, classifies them by target, generates LP-numbered proposals, and writes them to a review file the human edits.

```
  last-synthesis.md              review.md (existing, if any)
  ┌──────────────────┐          ┌───────────────────────┐
  │ Upgrade candidates│          │ Previous proposals    │
  │ Cross-ref signals │          │ Status: PENDING/etc   │
  └────────┬─────────┘          └───────────┬───────────┘
           │                                │
           └──────────┬─────────────────────┘
                      ▼
           ┌──────────────────────┐
           │  Target Classification│
           │  + Deduplication      │
           │  + Proposal Generation│
           └──────────┬───────────┘
                      │
                      ▼
               review.md (updated)
               Human edits statuses
```

---

## Algorithm Section Routing Table

Reflection themes map to Algorithm sections. This routing table determines where Algorithm-targeted fixes land:

| Theme Pattern | Algorithm Section | Target Location |
|---------------|-------------------|-----------------|
| ISC quality, criteria vague, wrong count | ISC Requirements, Quality Gate | `## Ideal State Criteria Requirements`, `## Ideal State Criteria Quality Gate` |
| Phase timing, budget, over-budget | Effort Level, Phase Budgets | `## RESPONSE DEPTH SELECTION`, phase budget tables |
| Capability selection, wrong tools | Capabilities Selection | `## CAPABILITIES SELECTION` |
| Agent overhead, wrong parallelization | Agent Instructions | `### Agent Instructions` |
| Context recovery, prior work missed | OBSERVE phase | `━━━ OBSERVE ━━━`, `**CONTEXT RECOVERY**` |
| Verification gaps, claims without proof | VERIFY phase | `━━━ VERIFY ━━━` |
| Plan mode, exploration depth | PLAN phase, Plan Mode | `━━━ PLAN ━━━`, `## Plan Mode Integration` |
| PRD issues, sync problems | PRD Integration | `## PRD Integration` |
| Phase merging, discrete violations | Phase Discipline | `## Discrete Phase Enforcement`, `## Phase Discipline Checklist` |
| Voice, notifications | Voice Announcements | `## Voice Phase Announcements` |
| Loop mode, iteration | Loop Mode, PRD Status | `### Multi-Iteration`, PRD status progression |
| Silent stalls, hanging | No Silent Stalls | `## No Silent Stalls` |

---

## Target Classification Logic

Each upgrade candidate gets classified to one of three targets:

| Signal Type | Target | Rationale |
|-------------|--------|-----------|
| Process/phase-gate issues (themes matching Algorithm section routing table above) | Algorithm spec | These are structural improvements to how the Algorithm operates |
| Behavioral STOP patterns (from ratings — things to stop doing) | AISTEERINGRULES.md | STOP rules are behavioral constraints, which is what AISTEERINGRULES defines |
| Behavioral DO MORE patterns (from ratings — things to amplify) | Feedback memories | DO MORE patterns become positive reinforcement stored as feedback memories |
| Cross-referenced signals | Whichever target the primary signal maps to | The cross-reference strengthens the signal but doesn't change the target |

---

## Proposal Lifecycle

```
[generated] --> [PENDING]
[PENDING]   --> [ACCEPTED] | [DEFERRED] | [REJECTED]
[ACCEPTED]  --> [APPLIED]  (only after staged diff is checked by human in Apply)
[DEFERRED]  --> [ACCEPTED] | [REJECTED]  (on next review cycle)
[REJECTED]  --> resurfaces only if signal has strengthened since rejection
```

---

## Execution

### Step 1: Ensure Fresh Synthesis

```
Check if ~/.pai/MEMORY/LEARNING/last-synthesis.md exists.

If it does NOT exist:
  - Report: "No synthesis found — running Check workflow first..."
  - Execute the Check workflow (Workflows/Check.md) fully
  - Then continue to Step 2

If it exists:
  - Read the frontmatter `generated` timestamp
  - If timestamp is > 24 hours old:
    - Report: "Synthesis is stale ([timestamp]) — re-running Check workflow..."
    - Execute the Check workflow (Workflows/Check.md) fully
    - Then continue to Step 2
  - If timestamp is < 24 hours old:
    - Report: "Using recent synthesis from [timestamp]"
    - Continue to Step 2
```

### Step 2: Read Synthesis for Upgrade Candidates

```
Read ~/.pai/MEMORY/LEARNING/last-synthesis.md in full.
Extract:
- All upgrade candidates (from Algorithm Reflections section)
- All STOP patterns (from Behavioral Signals section)
- All DO MORE patterns (from Behavioral Signals section)
- All cross-referenced signals (from Cross-Referenced Signals section)
- Metadata from frontmatter (reflections_analyzed, ratings_analyzed counts)
```

### Step 3: Read Existing Review File (for Dedup/Status)

```
Check if ~/.pai/MEMORY/LEARNING/review.md exists.

If it exists:
  - Read the full file
  - Parse all existing proposals: extract LP-xxx ID, title, status, severity, signal count
  - Note the highest LP number used (for numbering new proposals)
  - Collect REJECTED proposals with their signal counts at rejection time

If it does not exist:
  - Start fresh with LP-001
  - No deduplication needed
```

### Step 4: Classify Each Upgrade Candidate by Target

For each upgrade candidate from Step 2:

1. **Check if it matches an existing proposal** (deduplication):
   - Compare theme/title against existing proposals
   - If it matches a PENDING or DEFERRED proposal: update severity and occurrence count, don't create new
   - If it matches an ACCEPTED proposal: update severity/count (it will be applied soon)
   - If it matches an APPLIED proposal: skip (already addressed)
   - If it matches a REJECTED proposal: only create new if signal has strengthened (higher count or severity than at rejection time)

2. **Classify by target** using the target classification logic above:
   - Reflection themes matching the Algorithm section routing table → Algorithm spec
   - STOP patterns from ratings → AISTEERINGRULES.md
   - DO MORE patterns from ratings → Feedback memories
   - Cross-referenced signals → target of the primary signal

### Step 5: Generate Proposals

For each new or updated candidate, generate a proposal entry:

```markdown
## LP-[NNN] — [Short descriptive title]
- **Status: PENDING** <!-- PENDING | ACCEPTED | DEFERRED | REJECTED -->
- Severity: [CRITICAL / HIGH / MODERATE]
- Signal: [N] occurrences across reflections ([N]) and ratings ([N]), avg [N]/10
- Trend: [new / stable / worsening / improving]
- First seen: [date]
- Target: [Algorithm / AISTEERINGRULES.md / Feedback memory]
- Proposed change:
  > [Concrete description of what should change — 2-4 sentences]
- Notes:

---
```

### Step 6: Write review.md

```
Write (or update) ~/.pai/MEMORY/LEARNING/review.md

With YAML frontmatter:
---
generated: [ISO timestamp]
pipeline_version: 1.0.0
signals_since: [date of earliest signal in current window]
reflections: [N total reflections analyzed]
ratings: [N total ratings analyzed]
digest_covers: [date range, only if digest.md exists]
---

# Learning Review

[All proposals, newest first, separated by --- dividers]

[APPLIED proposals at the bottom, collapsed or clearly separated]
```

### Step 7: Tell User to Review

Output instructions:

```
## Review File Ready

**Location:** `~/.pai/MEMORY/LEARNING/review.md`
**Proposals:** [N] total — [N] new PENDING, [N] updated, [N] unchanged

### How to Review

Open the review file and change the status on each proposal:

| Status | Meaning |
|--------|---------|
| **PENDING** | Not yet reviewed — change to ACCEPTED, DEFERRED, or REJECTED |
| **ACCEPTED** | You want this change — it will be staged on next `/learn apply` |
| **DEFERRED** | Not now, but keep it — will be re-evaluated on next review |
| **REJECTED** | Don't want this — will only resurface if signal strengthens |

You can also add notes to any proposal explaining your reasoning.

When done, run `/learn apply` to stage and apply accepted changes.
```

---

## Review File Format Example

```markdown
---
generated: 2026-03-22T14:30:00Z
pipeline_version: 1.0.0
signals_since: 2026-03-19
reflections: 52
ratings: 780
---

# Learning Review

## LP-007 — Read before acting
- **Status: PENDING** <!-- PENDING | ACCEPTED | DEFERRED | REJECTED -->
- Severity: CRITICAL
- Signal: 10 occurrences across reflections (5) and ratings (5), avg 2.6/10
- Trend: stable
- First seen: 2026-03-19
- Target: Algorithm
- Proposed change:
  > Add pre-read gate to Phase 2: before executing any task,
  > read all referenced files and confirm understanding.
- Notes:

---

## LP-008 — Answering the wrong question
- **Status: PENDING** <!-- PENDING | ACCEPTED | DEFERRED | REJECTED -->
- Severity: CRITICAL
- Signal: 4 occurrences, avg 1.75/10
- Trend: new
- First seen: 2026-03-22
- Target: AISTEERINGRULES.md
- Proposed change:
  > Add rule: "Confirm the actual question before answering.
  > Restate it if ambiguous."
- Notes:

---
```

---

## Integration

- **Standalone:** User says "learn review" or "what should change"
- **From Check:** Natural next step after Check completes
- **Auto-prerequisite:** Automatically runs Check if synthesis is stale
- **To Apply:** Produces the review.md that Apply reads
