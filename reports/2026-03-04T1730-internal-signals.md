# PAI Internal Signals Report
**Generated:** 2026-03-04 17:30 GMT
**Sources:** 20 algorithm reflections | 756 ratings (102 non-neutral)

---

## Algorithm Reflections

**Source:** `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
**Entries analyzed:** 20 | **Date range:** 2026-02-20 to 2026-03-02

### Pre-read all target files before editing (3 occurrences, HIGH signal)
**Root cause:** BUILD phase starts editing without pre-loading files, causing mid-stream "file has not been read" errors
**Proposed fix:** Mandatory pre-BUILD sweep: collect all file paths, read them in one parallel batch
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`
**Evidence:**
- "I could have been faster by reading all 20 files in one batch at the start rather than discovering the error mid-stream"
- "I should have batched the file reads more aggressively to avoid the 'file has not been read' errors"
- "Pre-read all target files before entering the edit phase"

### Parallelize independent agents and steps (4 occurrences, HIGH signal)
**Root cause:** Algorithm serializes agent launches and tool calls with no data dependencies
**Proposed fix:** Map dependency graph before BUILD; foundation first, then fan out
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`
**Evidence:**
- "A smarter algorithm would have launched the Engineer agents immediately after Phase 0, without waiting for Phase 1"
- "Could have parallelised the test file writes in a single message block"
- "Could have parallelised the verification checks more aggressively — all Grep/Glob/Bash calls were independent"
- "I should have had the test agent run in parallel with the diff.ts edit fixes"

### Incremental build-and-validate cycles (2 occurrences, HIGH signal)
**Root cause:** Write-all-then-build means errors introduced early are discovered late
**Proposed fix:** Scaffold → validate → add content → validate → add features → validate
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`
**Evidence:**
- "Incremental validation catches issues at the moment they're introduced"
- "Could have written the script and tested in a single BUILD step rather than writing then editing"

### ISC templates for recurring task types (2 occurrences, MEDIUM signal)
**Root cause:** OBSERVE/THINK reinvents ISC structure for known task types sharing 80%+ of concerns
**Proposed fix:** Library of ISC starter templates for framework migration, CLI build, viability review
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`, `~/.claude/PAI/ISC-templates/`
**Evidence:**
- "Framework migrations share 80% of the same structural concerns regardless of source/target"
- "Should have detected the 'project viability review' pattern and fast-tracked to a decision framework"

### Check sibling files before creating new ones (2 occurrences, MEDIUM signal)
**Root cause:** OBSERVE skips checking how existing infrastructure works before building new instances
**Proposed fix:** Read one sibling file for structure and permissions before writing new ones
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`
**Evidence:**
- "Should have checked the skill discovery mechanism in OBSERVE rather than discovering it during BUILD"
- "Should have checked file permissions of sibling hooks before writing new ones"

### Proactive project health monitoring (2 occurrences, MEDIUM signal)
**Root cause:** No cross-session pattern recognition for structural debt signals
**Proposed fix:** Check recent git log of target component in OBSERVE; flag if bug-fix commits outnumber feature commits
**Target:** `~/.claude/PAI/Algorithm/v3.7.0.md`
**Evidence:**
- "Should have flagged the 10-bug-fix commit as a project health signal in an earlier session"
- "When a wrapper tool's bug count exceeds its command count, the abstraction is costing more than it saves"

---

## Execution Warnings (from Q1 answers)

- Tilde escaping errors in bash scripts: used `\~` instead of `~` in replacement strings — test script once before finalizing
- `wc -l` vs Read tool line-count discrepancy — use `wc -l` as source of truth for line counts
- Skill registry discovery waste — one early Grep would have eliminated the OBSERVE detour
- Duplicate config keys introduced during file writing, caught only at build time — pre-write dedup check
- Sequential agent launches when agents are independent — launched in waves instead of all at once

---

## Aspirational Insights (from Q3 answers)

- Direct writing beats agent delegation when source material is already in context — delegate only when fresh context window helps
- Infrastructure-level control is more reliable than prompt-level control — hooks > prompt instructions
- Safe-default principle: check `!== false` rather than `=== true` so new installs work out of the box
- Constraint-driven design eliminates decision fatigue — hard limits make every decision obvious
- "Foundation first, then parallel fan-out" is the canonical template for multi-file builds
- Pre-composed edits for known file paths — compose sidebar/config edits before agents finish writing

---

## Behavioral Signals from Ratings

**Source:** `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl`
**Entries analyzed:** 756 | **Explicit feedback:** 12 | **Problem sessions:** 7
**Rating distribution:** 652 neutral (5), 50 low (<=4), 33 high (>=8), 21 mid-range

### STOP (Low-Rating Patterns)

| Pattern | Frequency | Avg Rating | Examples |
|---------|-----------|------------|----------|
| Operating on wrong repo/path | 3 | 2.7 | Confused ~/.claude/ with /projects/pai; confused fork with upstream |
| Incomplete answers without surfacing incompleteness | 4 | 3.2 | Vague diagnosis instead of identifying bugs; no fix instructions with errors |
| Acting when user wanted a question asked | 3 | 3.0 | Researched instead of asking; acted instead of informing |
| Overstepping scope | 4 | 3.25 | Actions beyond what was asked; required user to undo work |
| Providing incorrect/outdated info | 4 | 3.5 | Contradicted migration docs; wrong references; outdated reports |
| Inconsistent approaches mid-session | 2 | 3.5 | Confused user with changing strategy mid-task |
| Confusing CC commands with PAI skills | 1 | 3.0 | Treated /upgrade as built-in Claude Code command |

### DO MORE (High-Rating Patterns)

| Pattern | Frequency | Avg Rating | Examples |
|---------|-----------|------------|----------|
| Comprehensive deep research with synthesis | 11 | 9.0 | Strongest positive signal — research depth and synthesis quality |
| Thorough, ship-ready documentation | 9 | 9.0 | Complete deliverables, comprehensive developer references |
| Thorough verification with change documentation | 4 | 8.75 | Evidence-backed completion, ready to ship |
| Ethical judgment and boundary-setting | 1 | 8.0 | Knowing when to stop and ask |
| Correct bug diagnosis before acting | 1 | 9.0 | MineRatings ARG_MAX fix — diagnosed correctly then fixed |

### Explicit User Feedback

| Date | Rating | Comment |
|------|--------|---------|
| 2026-03-04 | 2/10 | "run the local ~/ versions NOT the repo" |
| 2026-03-04 | 3/10 | "isn't /upgrade a built in CC command NOT a PAI skill?" |
| 2026-03-04 | 9/10 | "great results from MineRatings" |
| 2026-03-03 | 3/10 | "no, ask the question, don't research." |
| 2026-03-03 | 4/10 | "make it clear what's changed between the prior version of v4.0.3 and the new one" |
| 2026-03-02 | 2/10 | "why are you looking in /Users/ianmarr/projects/pai??" |
| 2026-03-02 | 3/10 | "that's an incomplete answer. Why didn't MineRatings run? Is it a bug?" |
| 2026-03-01 | 10/10 | "post it to the PAI discussions, categories and flagged as a Enhancement proposal" |
| 2026-03-01 | 4/10 | "you're confusing GH CC and danielmiessler/Personal_AI_Infrastructure" |
| 2026-03-01 | 4/10 | "I'm more interested in discussions and issues in danielmiessler/Personal_AI_Infrastructure" |
| 2026-03-02 | 8/10 | "good doc" |
| 2026-03-02 | 4/10 | "YES!" (confirming MineRatings did not run) |

### Problem Sessions

| Session | Avg Rating | Entries | Themes |
|---------|------------|---------|--------|
| 094aebb2 | 3.9 | 10 | Auth error without fix; acted without informing; misunderstood scope |
| f357753d | 3.0 | 3 | Incomplete MineRatings diagnosis; wrong path; multiple follow-ups needed |
| 1bcbfe82 | 4.0 | 1 | Confused two GitHub repos |
| 722081b4 | 4.0 | 1 | Didn't make clear what changed vs prior version |
| a5cdce7c | 3.0 | 1 | Explanation didn't clarify the comparison |
| 04f0a6b9 | 2.0 | 1 | Severe failure — no sentiment recorded |
| cbc14f65 | 4.0 | 1 | Viki behavior not triggering correctly |

---

## Data Quality Note

86% of ratings (652/756) are exactly 5 — likely a neutral/default value rather than deliberate scoring. All patterns in this report are grounded in the 104 non-5 entries only. Explicit feedback (12 entries with typed comments) carries the highest signal weight.
