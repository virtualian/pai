## Learning Pipeline: Revised Design Specification

### Problem

The Learning sub-skill has four workflows that don't pass data to each other, three downstream targets with no automated path, and no mechanism for accumulating and reviewing proposed changes over time. The pipeline needs to be a single coherent flow that a human can operate without remembering stage names or execution order.

### Goal

Improve agentic behaviour, problem-solving capability, and accuracy over time via a closed feedback loop: record activity → extract signals → synthesise patterns → propose changes → human review → apply. All of this behind three commands.

### Human interface

```
/learn check    — What's happening? Run analysis, print summary.
/learn review   — What should change? Generate/update review file, open it.
/learn apply    — Do it. Stage diffs for accepted proposals, open for final check, apply.
```

`/learn` with no argument shows current status: when check last ran, how many pending/deferred/accepted proposals, whether unprocessed signals exist since last check.

Each command runs its prerequisites silently if stale. The human never thinks about pipeline ordering.

### Pipeline stages

**1. Mine** — Extract raw signals from two append-only sources:
- `algorithm-reflections.jsonl` → structural observations (process failures, what worked)
- `ratings.jsonl` → behavioural ratings (STOP / DO MORE patterns with scores)

**2. Synthesise** — Cross-reference reflections and ratings into a prioritised list of upgrade candidates. Each candidate includes: signal source(s), occurrence count, average score (if rated), severity (CRITICAL / HIGH / MODERATE), and trend direction.

Runs against **full dataset**, not incremental slices. The more data, the better the pattern extraction. Two-tier input:
- **Digest** — Compressed summary of all signals older than a compaction threshold. Human-readable, human-editable. Generated when the raw window gets too large to process efficiently.
- **Recent window** — Raw signals since the last digest. Processed in full.

Compaction is a human decision, not scheduled. Trigger is "this is taking too long" or "enough history to summarise confidently."

**3. Propose** — For each upgrade candidate, generate a concrete change proposal against one of three targets:

| Target | Content type | Example |
|---|---|---|
| Algorithm spec | Process/phase-gate diffs | Add pre-read gate to Phase 2 |
| AISTEERINGRULES.md | Behavioural rules | "Confirm the actual question before answering" |
| Feedback memories | Persistent DO MORE / STOP entries | "Comprehensive research is highly valued" |

Checks the existing review file before generating. If a candidate matches a pending/deferred proposal, updates severity and occurrence count rather than duplicating. If it matches a rejected proposal, only resurfaces if the signal has strengthened since rejection.

**4. Review** — Human edits `MEMORY/LEARNING/review.md` in their editor. Changes the status field on each proposal. No other interaction required.

**5. Apply** — Two-gate approval in a single invocation, modelled on `git rebase -i`: generate, open editor, wait, execute.

The review file captures intent ("yes, I want this kind of change"). But intent is not a diff. The DA must read each target file, understand its structure, and generate a concrete edit. Apply is an agentic step, not a copy operation.

Single invocation flow:

```
/learn apply
  1. Read review.md, collect all ACCEPTED proposals
  2. For each, read the current target file and generate a concrete diff
  3. Write all diffs to MEMORY/LEARNING/staged-changes.md
  4. Open staged-changes.md in editor
  5. Human checks/unchecks per-proposal approval boxes, saves, closes
  6. Read staged-changes.md, apply only checked changes to targets
  7. Mark applied proposals as APPLIED in review.md with timestamp
  8. Unchecked proposals stay ACCEPTED for the next apply cycle
```

If no ACCEPTED proposals exist, the command says so and exits.

**Per-target mechanics:**

| Target | How the edit works |
|---|---|
| Algorithm spec | Section-aware insert/replace. DA reads the spec structure, identifies the correct section, generates a diff. Most changes are additions or rewording of existing steps. |
| AISTEERINGRULES.md | Append. Almost always a new rule added to an existing section. Simplest target. |
| Feedback memories | File-based append to the appropriate PAI memory file. Same pattern as AISTEERINGRULES — new entries added to existing structure. Exact file location is determined by PAI's memory directory layout. |

**Edge cases:**

- **Target file changed since proposal was generated.** Diffs are generated against the current file, not a snapshot from proposal time. If someone already made the change by hand, the DA should detect the overlap and flag it rather than duplicating.
- **Multiple proposals touching the same file.** Processed in proposal order (LP-007 before LP-008). Each subsequent diff is generated against the file as modified by prior diffs in the batch. The staged output shows the cumulative result so the human can spot conflicts.
- **Human unchecks everything.** Nothing is applied. Proposals stay ACCEPTED. Staged file is discarded on next run.

### Staged changes file format

Location: `MEMORY/LEARNING/staged-changes.md` — transient, regenerated each apply run.

```markdown
---
staged_at: 2026-03-22T16:00:00Z
source: MEMORY/LEARNING/review.md
proposals: [LP-007, LP-008]
---

# Staged Changes

## LP-007 — Read before acting
- Target: `~/.claude/skills/CORE/Algorithm v3.7.0.md`
- Section: Phase 2 — Execution
- Action: Insert after line 47

```diff
 ## Phase 2: Execution

+### Pre-read gate
+Before executing any task, read all files and resources
+referenced in the request. Confirm understanding of their
+current state before proceeding. If any referenced file
+cannot be found, stop and clarify with the human.
+
 ### Step 1: Execute the plan
```

- [x] Apply this change

---

## LP-008 — Answering the wrong question
- Target: `~/.claude/AISTEERINGRULES.md`
- Section: Append to ## Behavioral Rules
- Action: Append

```diff
+- Confirm the actual question before answering. If the
+  request is ambiguous, restate your interpretation and
+  ask for confirmation before proceeding.
```

- [ ] Apply this change

---
```

Checkboxes default to checked. The human unchecks what they don't want. This biases toward applying what was already accepted — the conservative action is to uncheck, not to check.

### Stage characteristics

| Stage | Stateless or stateful | Output |
|---|---|---|
| Mine | Stateless | Raw signal extraction (replaced each run) |
| Synthesise | Stateless | Pattern analysis (replaced each run) |
| Propose | Stateful | Merges into review file |
| Review | Stateful | Human edits review file |
| Apply | Stateful | Generates staged-changes.md (transient), writes to targets, updates review file |

Analytical stages (Mine, Synthesise) are pure functions of the current signal corpus. Re-running is always safe. Decision stages (Propose, Review, Apply) maintain accumulated human judgment in the review file.

### Proposal lifecycle

```
[generated] → [PENDING]
[PENDING]   → [ACCEPTED] | [DEFERRED] | [REJECTED]
[ACCEPTED]  → [APPLIED]  (only after staged diff is checked by human)
[DEFERRED]  → [ACCEPTED] | [REJECTED]  (on next review)
[REJECTED]  → resurfaces only if signal strengthens
```

Two gates before any change is written: ACCEPTED in the review file (intent), then checkbox checked in the staged changes file (concrete diff). An ACCEPTED proposal whose staged diff is unchecked stays ACCEPTED — the intent stands, the implementation needs another pass.

### Review file format

Location: `MEMORY/LEARNING/review.md` — single file, git-tracked.

```markdown
---
generated: 2026-03-22T14:30:00Z
pipeline_version: 1.0.0
signals_since: 2026-03-19
reflections: 52
ratings: 780
digest_covers: 2026-01-15 to 2026-03-15  # omitted if no digest yet
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

On `/learn review`:
- New proposals append as PENDING
- Existing proposals keep their current status
- Signal counts and severity update from latest synthesis
- APPLIED proposals remain in file as history (collapsed or at bottom)

The human opens the file, changes `PENDING` to `ACCEPTED`/`DEFERRED`/`REJECTED`, optionally adds notes explaining their reasoning, saves. That is the entire review interaction.

### Digest format

Location: `MEMORY/LEARNING/digest.md` — generated by compaction, human-editable.

```markdown
---
compacted_at: 2026-06-01
covers: 2026-01-15 to 2026-05-31
reflections_summarised: 312
ratings_summarised: 4200
---

## Persistent patterns
- "read before acting": 47 occurrences, avg 2.8, trend: stable
- "comprehensive research valued": 89 occurrences, avg 8.9, trend: improving

## Resolved patterns (declined after fixes applied)
- "path mismatch errors": peaked at 12, dropped to 0 after LP-003 applied

## Weak signals (< 5 occurrences, watching)
- ...
```

### Structured output requirement

Every stage writes a Markdown file with YAML front matter:

```yaml
---
stage: synthesise
ran_at: 2026-03-22T14:30:00Z
pipeline_version: 1.0.0
prompt_hash: a3f8c1d
input_files:
  - MEMORY/LEARNING/digest.md
  - MEMORY/LEARNING/mine-output.md
---
```

`prompt_hash` tracks the version of the processing prompt, not just the data. If the prompt changes, synthesis output is no longer comparable to prior runs — the front matter makes that visible.

### Out of scope

- Automated scheduling / cron triggers
- Multi-principal (team) learning
- Pipeline branching or parallel execution
- Dependency tracking between proposals
- Automatic rollback
- TUI interface (planned future, not v1)
