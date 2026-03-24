# Plan: Promote Learning to Top-Level Skill with Unified Pipeline

## Context

Issue #92 started as "reapply local Utilities customizations" but uncovered two architectural gaps: (1) Learning workflows don't pass data to each other, and (2) two downstream targets (AISTEERINGRULES.md, feedback memories) have no automated learning path. Ian wrote a comprehensive spec (`2026-03-22-learning-pipeline-spec.md`) that redesigns the entire Learning sub-skill as a unified 5-stage pipeline behind 3 commands. Decisions made: promote to top-level pack, refactor existing workflows.

## Approach

### New Pack Structure

```
Packs/Learning/
├── README.md
├── INSTALL.md
├── VERIFY.md
└── src/
    ├── SKILL.md              ← /learn routing + status display
    ├── Workflows/
    │   ├── Check.md          ← /learn check (Mine + Synthesise + summary)
    │   ├── Review.md         ← /learn review (Propose + open review.md)
    │   └── Apply.md          ← /learn apply (two-gate approval)
    └── Tools/
        └── MineRatings.ts    ← moved from Utilities/Learning/Tools/
```

### File-by-File Plan

#### 1. `src/SKILL.md` — Routing and Status

Frontmatter:
```yaml
---
name: Learning
description: Closed-loop behavioural improvement — mine signals, synthesise patterns, propose changes, review, apply. USE WHEN learn, learn check, learn review, learn apply, mine reflections, mine ratings, algorithm upgrade, improve the algorithm, what have we learned, internal improvements, close the loop, learning synthesis, learning status.
---
```

Routing table:
| Trigger | Route |
|---------|-------|
| "learn check", "check signals", "what's happening" | `Workflows/Check.md` |
| "learn review", "review proposals", "what should change" | `Workflows/Review.md` |
| "learn apply", "apply changes", "apply proposals" | `Workflows/Apply.md` |

Bare `/learn` (no subcommand): Show status — when check last ran, pending/deferred/accepted proposal counts, whether unprocessed signals exist since last check. Read from `review.md` frontmatter + compare JSONL mtimes.

Include voice notification pattern, customization check, and architecture diagram from spec.

#### 2. `src/Workflows/Check.md` — Mine + Synthesise

Refactored from: `MineReflections.md`, `MineRatings.md` (agent prompts), `Synthesize.md` (parallel architecture + cross-reference logic).

**What to preserve:**
- Reflection Miner agent prompt (from Synthesize.md lines 50-85) — exact prompt, proven effective
- Ratings Miner agent prompt (from Synthesize.md lines 87-121) — exact prompt, proven effective
- Signal prioritization weights (from MineReflections.md)
- Cross-reference logic (from Synthesize.md Step 3)

**What to add (from spec):**
- Write `MEMORY/LEARNING/mine-output.md` with YAML frontmatter (stage, ran_at, pipeline_version, input_files)
- Write `MEMORY/LEARNING/last-synthesis.md` with YAML frontmatter (already designed in prior commit)
- Support digest input: if `MEMORY/LEARNING/digest.md` exists, use it as compressed history + only process raw signals since digest date
- Print summary to conversation after writing files

**Structure:**
```
Step 1: Check for digest (compressed history)
Step 2: Launch parallel miners (2 agents — reuse existing prompts)
Step 3: Collect results
Step 4: Cross-reference reflections × ratings
Step 5: Write mine-output.md (raw mining results, YAML frontmatter)
Step 6: Write last-synthesis.md (cross-referenced synthesis, YAML frontmatter)
Step 7: Print summary to conversation
```

#### 3. `src/Workflows/Review.md` — Propose + Open Review File

Refactored from: `AlgorithmUpgrade.md` (section routing table, proposal format). Mostly **new** — the Propose stage doesn't exist in current code.

**What to preserve:**
- Algorithm section routing table (from AlgorithmUpgrade.md) — the 12 theme→section mappings
- Upgrade proposal format structure

**What to add (from spec):**
- Three-target proposal generation (Algorithm, AISTEERINGRULES, Feedback memories)
- Deduplication against existing review.md (update severity/count, don't duplicate)
- Respect rejected proposals (only resurface if signal strengthened)
- LP-xxx numbering scheme
- Proposal lifecycle: PENDING → ACCEPTED/DEFERRED/REJECTED → APPLIED
- Review file format with YAML frontmatter (per spec)
- Auto-run Check if stale (no last-synthesis.md or > 24h old)

**Structure:**
```
Step 1: Ensure fresh synthesis (run Check if stale)
Step 2: Read last-synthesis.md for upgrade candidates
Step 3: Read existing review.md (if exists) for dedup/status tracking
Step 4: For each upgrade candidate, determine target (Algorithm / AISTEERINGRULES / Memory)
Step 5: Generate proposals — merge into review.md (new=PENDING, existing=update counts)
Step 6: Write review.md with frontmatter
Step 7: Tell user to open and edit review.md, explain the status fields
```

**Target classification logic:**
| Signal type | Target |
|-------------|--------|
| Process/phase-gate issues (Q2 themes matching Algorithm section routing table) | Algorithm spec |
| Behavioral STOP patterns (from ratings) | AISTEERINGRULES.md |
| Behavioral DO MORE patterns (from ratings) | Feedback memories |
| Cross-referenced signals | Whichever target the primary signal maps to |

#### 4. `src/Workflows/Apply.md` — Two-Gate Approval

**Entirely new** — no existing code to refactor.

**Two-invocation pattern** (adapted for Claude Code):
1. First invocation: Read review.md → collect ACCEPTED proposals → generate staged-changes.md with diffs → tell user to review
2. Second invocation: Read staged-changes.md → apply only checked changes → update review.md statuses to APPLIED

**Structure:**
```
Step 1: Read review.md, collect ACCEPTED proposals
Step 2: If no ACCEPTED proposals, say so and exit
Step 3: For each ACCEPTED proposal, read the current target file
Step 4: Generate concrete diffs (section-aware for Algorithm, append for AISTEERINGRULES/memories)
Step 5: Write staged-changes.md with checkbox format (per spec)
Step 6: Tell user to review staged-changes.md, edit checkboxes, then invoke /learn apply again
---
On re-invocation (staged-changes.md exists):
Step 7: Read staged-changes.md
Step 8: For each checked proposal, apply the diff to the target file
Step 9: Mark applied proposals as APPLIED in review.md with timestamp
Step 10: Delete staged-changes.md (transient)
```

**Per-target apply mechanics** (from spec):
| Target | How |
|--------|-----|
| Algorithm spec | Section-aware Edit — read structure, find section, insert/replace |
| AISTEERINGRULES.md | Append rule to appropriate location |
| Feedback memories | Write new memory file to PAI memory directory |

#### 5. `src/Tools/MineRatings.ts`

**Move as-is** from `Packs/Utilities/src/Learning/Tools/MineRatings.ts`. No changes to the tool itself — only the path it's installed to changes (`~/.claude/skills/Learning/Tools/` instead of `~/.claude/skills/Utilities/Learning/Tools/`).

#### 6. Utilities Pack Cleanup

**Files to modify in `Packs/Utilities/src/`:**

- **Remove:** `Learning/` directory entirely (SKILL.md, Tools/, Workflows/)
- **Edit `SKILL.md`:** Remove "learning pipeline" from description, remove all learning keywords from USE WHEN, remove Learning routing row
- **Edit `PAIUpgrade/SKILL.md`:** Update references from `skills/Utilities/Learning/` to `skills/Learning/`
- **Edit `PAIUpgrade/Workflows/Upgrade.md`:** Update Thread 3 path from `~/.claude/skills/Utilities/Learning/Workflows/Synthesize.md` to reference the new Learning skill's Check workflow (or keep referencing last-synthesis.md directly since Check writes it)

#### 7. Pack Boilerplate (README.md, INSTALL.md, VERIFY.md)

Follow Research pack patterns:
- **README.md:** Pack overview, the 3 commands, pipeline diagram, proposal lifecycle, file layout
- **INSTALL.md:** Wizard-style with system analysis, conflict check, copy src/ to ~/.claude/skills/Learning/
- **VERIFY.md:** Check SKILL.md exists, 3 workflow files exist, MineRatings.ts exists, frontmatter valid

### Execution Order

1. Create `Packs/Learning/` directory and boilerplate (README, INSTALL, VERIFY)
2. Write `src/SKILL.md`
3. Write `src/Workflows/Check.md` (refactored from existing)
4. Write `src/Workflows/Review.md` (mostly new, reuses AlgorithmUpgrade routing table)
5. Write `src/Workflows/Apply.md` (new)
6. Move `src/Tools/MineRatings.ts`
7. Clean up Utilities pack (remove Learning/, update SKILL.md, update PAIUpgrade refs)
8. Install new Learning pack
9. Reinstall Utilities pack (without Learning)
10. Verify both installations

### What NOT to change

- MineRatings.ts internals — the tool works, just moves
- PAIUpgrade Upgrade workflow structure — only update the Learning skill path in Thread 3
- Any hooks (RatingCapture, WorkCompletionLearning, LoadContext, learning-readback) — they write to MEMORY/LEARNING/ which stays the same
- The MEMORY/LEARNING/ directory layout — all existing data files stay where they are

## Verification

1. `ls ~/.claude/skills/Learning/` — SKILL.md, Workflows/, Tools/ all present
2. `ls ~/.claude/skills/Learning/Workflows/` — Check.md, Review.md, Apply.md
3. `ls ~/.claude/skills/Learning/Tools/` — MineRatings.ts
4. `ls ~/.claude/skills/Utilities/Learning/` — should NOT exist
5. `grep "Learning" ~/.claude/skills/Utilities/SKILL.md` — should find NO matches
6. `grep "skills/Learning" ~/.claude/skills/Utilities/PAIUpgrade/SKILL.md` — should reference new path
7. Functional: say "learn check" → should route to Learning skill, run Check workflow
