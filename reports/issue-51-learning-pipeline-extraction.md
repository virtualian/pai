# Issue #51: Learning Pipeline Extraction from PAIUpgrade

## Investigation Report

**Date:** 2026-03-05
**Author:** Architect Agent (Serena Blackwood)
**Status:** Investigation complete, ready for implementation
**Related issues:** #50 (Close the learning loop), #51 (Extract learning pipeline)

> **Path convention:** All file paths are relative to repo root (`pai/`). Runtime-only data paths under `~/.claude/MEMORY/` are marked as such since they don't exist in the repo.

---

## 1. Executive Summary

PAIUpgrade currently conflates two distinct concerns: external upgrade discovery (~69% of the skill by line count) and internal learning pipeline analysis (~31%). This investigation maps every file involved, defines clean ownership boundaries, and provides an actionable extraction plan.

**Key findings:**

- Three learning-specific workflows (MineReflections, AlgorithmUpgrade, Thread 3 of Upgrade) and one learning-specific tool (MineRatings.ts) are embedded inside PAIUpgrade. They share zero code with the external discovery workflows.
- The coupling point is exactly one: Thread 3 in Upgrade.md (lines 252-331) spawns inline reflection/ratings mining agents and renders their output in the Internal Signals section (lines 504-545). Decoupling requires replacing inline agent prompts with a cross-skill invocation.
- The hooks infrastructure (RatingCapture, WorkCompletionLearning, LoadContext, learning-readback, learning-utils) should remain as infrastructure. Hooks are event-driven capture/readback; the new skill owns analysis workflows that run on demand.
- The recommended skill name is **Learning** (under `Releases/v4.0.3/.claude/skills/Utilities/Learning/`), following the PAI convention of concise TitleCase names that describe the domain.

**Recommended architecture:**

```
BEFORE (tangled):                    AFTER (separated):

PAIUpgrade/                          PAIUpgrade/
  Workflows/                           Workflows/
    Upgrade.md (Thread 3 inline)         Upgrade.md (calls Learning skill)
    MineReflections.md                   ResearchUpgrade.md
    AlgorithmUpgrade.md                  FindSources.md
    ResearchUpgrade.md                 Tools/
    FindSources.md                       Anthropic.ts
  Tools/                               sources.json, youtube-channels.json
    MineRatings.ts
    Anthropic.ts                     Learning/          <-- NEW
  sources.json, youtube-channels.json  Workflows/
                                         MineReflections.md
hooks/ (unchanged)                       MineRatings.md     (workflow wrapper)
  RatingCapture.hook.ts                  AlgorithmUpgrade.md
  WorkCompletionLearning.hook.ts         Synthesize.md      (new: Thread 3 replacement)
  LoadContext.hook.ts                  Tools/
  lib/learning-readback.ts               MineRatings.ts
  lib/learning-utils.ts
                                     hooks/ (unchanged)
                                       RatingCapture.hook.ts
                                       WorkCompletionLearning.hook.ts
                                       LoadContext.hook.ts
                                       lib/learning-readback.ts
                                       lib/learning-utils.ts
```

---

## 2. Current State Inventory

### 2.1 Learning Components (Moving OUT of PAIUpgrade)

| File | Location | Lines | Purpose | Data Source |
|------|----------|-------|---------|-------------|
| **MineReflections.md** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` | 163 | Mines `algorithm-reflections.jsonl` for upgrade candidates via sentiment/budget/criteria weighting and Q1/Q2/Q3 theme clustering | `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` (runtime, 32KB, 23 entries) |
| **AlgorithmUpgrade.md** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` | 237 | Mines reflections with Algorithm section routing, proposes section-targeted patches to Algorithm spec, assesses version bumps | `algorithm-reflections.jsonl` + `Releases/v4.0.3/.claude/PAI/Algorithm/v*.md` |
| **MineRatings.ts** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/` | 363 | Analyzes `ratings.jsonl` for behavioral patterns (STOP/DO MORE), uses HWM state tracking, session grouping, Inference-based synthesis | `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl` (runtime, 166KB, 757 entries) |
| **Upgrade.md Thread 3** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/Upgrade.md` lines 252-331 | 80 | Inline agent prompts that run MineReflections + MineRatings in parallel; results rendered at lines 504-545 as "Internal Signals" output section | Same as MineReflections + MineRatings |

**Total learning lines in PAIUpgrade:** ~843 lines (163 + 237 + 363 + 80)

### 2.2 Non-Learning Components (Staying in PAIUpgrade)

| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| **SKILL.md** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/` | 492 | Skill routing, output format, extraction rules, examples |
| **Upgrade.md** (Threads 1-2 + synthesis) | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` | 664 (744 total minus 80 Thread 3) | User context analysis, external source collection, synthesis, report generation |
| **ResearchUpgrade.md** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` | 208 | Deep-dive research on specific upgrade opportunities |
| **FindSources.md** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` | 240 | Discover new monitoring sources (YouTube, blogs, GitHub) |
| **Anthropic.ts** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/` | 879 | Monitor 30+ Anthropic sources for updates |
| **sources.json** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/` | Config | Anthropic source definitions |
| **youtube-channels.json** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/` | Config | Base YouTube channel config |
| **State/last-check.json** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/State/` | State | Anthropic monitoring state |
| **State/youtube-videos.json** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/State/` | State | YouTube monitoring state |
| **State/github-trending.json** | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/State/` | State | GitHub trending state |

**Total non-learning lines in PAIUpgrade:** ~2,483 lines

### 2.3 Hooks Infrastructure (Not Moving -- remains as event-driven infrastructure)

| File | Location | Lines | Purpose | Relationship to Learning |
|------|----------|-------|---------|--------------------------|
| **RatingCapture.hook.ts** | `Releases/v4.0.3/.claude/hooks/` | 553 | Captures explicit/implicit ratings to `ratings.jsonl` on UserPromptSubmit | **Producer** -- writes data that MineRatings consumes |
| **WorkCompletionLearning.hook.ts** | `Releases/v4.0.3/.claude/hooks/` | 373 | Captures work session metadata to `MEMORY/LEARNING/` at SessionEnd | **Producer** -- writes learning files |
| **LoadContext.hook.ts** | `Releases/v4.0.3/.claude/hooks/` | 536 | Reads learning data back into context at SessionStart | **Consumer** -- reads via learning-readback.ts |
| **learning-readback.ts** | `Releases/v4.0.3/.claude/hooks/lib/` | 222 | Fast readers: loadLearningDigest, loadWisdomFrames, loadFailurePatterns, loadSignalTrends | **Consumer** -- provides readback functions |
| **learning-utils.ts** | `Releases/v4.0.3/.claude/hooks/lib/` | 80 | Categorization (SYSTEM vs ALGORITHM), learning detection | **Shared** -- used by RatingCapture + WorkCompletionLearning |

**Total hooks infrastructure lines:** 1,764 lines

### 2.4 Data Files (Runtime Only)

| File | Location (runtime) | Size | Entries | Writers | Readers |
|------|----------|------|---------|---------|---------|
| `algorithm-reflections.jsonl` | `~/.claude/MEMORY/LEARNING/REFLECTIONS/` | 32KB | 23 | Algorithm LEARN phase (manual in v4.0.2, hook in v4.0.3) | MineReflections, AlgorithmUpgrade, Upgrade Thread 3 |
| `ratings.jsonl` | `~/.claude/MEMORY/LEARNING/SIGNALS/` | 166KB | 757 | RatingCapture.hook.ts | MineRatings.ts, Upgrade Thread 3 |
| `mine-ratings-hwm.json` | `~/.claude/MEMORY/LEARNING/SIGNALS/` | ~100B | 1 | MineRatings.ts | MineRatings.ts |
| `learning-cache.sh` | `~/.claude/MEMORY/STATE/` | ~500B | 1 | External (cron/manual) | learning-readback.ts (loadSignalTrends) |

---

## 3. Extraction Architecture

### 3.1 What Moves

| From | To | Change Type |
|------|----|-------------|
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineReflections.md` | Move (update voice notification to reference Learning skill) |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/AlgorithmUpgrade.md` | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/AlgorithmUpgrade.md` | Move (update voice notification, update references) |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/MineRatings.ts` | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Tools/MineRatings.ts` | Move (update import paths for `inference.ts`) |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/Upgrade.md` Thread 3 (lines 252-331) | Deleted from Upgrade.md; functionality replaced by `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/Synthesize.md` | Refactor -- inline prompts extracted to standalone workflow |

### 3.2 What Gets Created

| File | Purpose |
|------|---------|
| `Releases/v4.0.3/.claude/skills/Utilities/Learning/SKILL.md` | Skill definition with routing table, triggers, examples |
| `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/Synthesize.md` | New workflow: runs MineReflections + MineRatings in parallel, produces combined "Internal Signals" output suitable for consumption by PAIUpgrade or standalone |
| `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineRatings.md` | New workflow: wraps `Tools/MineRatings.ts` with voice notification and integration notes (workflow layer for the CLI tool) |

### 3.3 What Gets Modified

| File | Modification |
|------|-------------|
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/SKILL.md` | Remove MineReflections, AlgorithmUpgrade, and MineRatings triggers from routing table; add note about Learning skill dependency for internal signals |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/Upgrade.md` | Replace Thread 3 inline agent prompts (lines 252-331) with cross-skill invocation: "Run the Synthesize workflow from the Learning skill"; keep Internal Signals output template (lines 504-545) but populate from Learning skill output |

### 3.4 What Stays Unchanged

| Component | Why |
|-----------|-----|
| All hooks (`RatingCapture`, `WorkCompletionLearning`, `LoadContext`) | Event-driven infrastructure, not skill-invoked. They produce/consume data independently of any skill. |
| `Releases/v4.0.3/.claude/hooks/lib/learning-readback.ts` | Used by LoadContext at session start. Not part of the analysis pipeline. |
| `Releases/v4.0.3/.claude/hooks/lib/learning-utils.ts` | Shared utility for categorization. Used by hooks, not skills. |
| All data files (`ratings.jsonl`, `algorithm-reflections.jsonl`, etc.) | Data layer is independent of which skill reads it. |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/ResearchUpgrade.md` | Pure external discovery -- no learning pipeline involvement. |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/FindSources.md` | Pure external discovery -- no learning pipeline involvement. |
| `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/Anthropic.ts` | Pure external discovery -- no learning pipeline involvement. |

---

## 4. Ownership Boundaries

### 4.1 Clear Ownership Table

| Component | Owner | Rationale |
|-----------|-------|-----------|
| **MineReflections workflow** | Learning skill | Analyzes internal reflections -- pure learning analysis |
| **AlgorithmUpgrade workflow** | Learning skill | Its INPUT is learning data (reflections); its PURPOSE is learning-driven improvement. Although it proposes changes to the Algorithm spec, the analysis methodology is learning, not upgrade discovery |
| **MineRatings tool + workflow** | Learning skill | Analyzes ratings data -- pure learning analysis |
| **Synthesize workflow** (new) | Learning skill | Orchestrates reflection + ratings mining in parallel -- replaces Upgrade Thread 3 |
| **Upgrade workflow** | PAIUpgrade skill | External discovery + user context + synthesis. Calls Learning skill for internal signals as a dependency |
| **ResearchUpgrade workflow** | PAIUpgrade skill | Deep-dive on external upgrade opportunities |
| **FindSources workflow** | PAIUpgrade skill | External source discovery |
| **Anthropic.ts tool** | PAIUpgrade skill | External source monitoring |
| **RatingCapture hook** | Hooks infrastructure | Event-driven capture at UserPromptSubmit. Not invoked by skills |
| **WorkCompletionLearning hook** | Hooks infrastructure | Event-driven capture at SessionEnd. Not invoked by skills |
| **LoadContext hook** | Hooks infrastructure | Session startup context injection. Not invoked by skills |
| **learning-readback.ts** | Hooks infrastructure | Fast readers called by LoadContext. Part of the hooks library |
| **learning-utils.ts** | Hooks infrastructure | Shared categorization utility. Part of the hooks library |
| **Data files** (ratings.jsonl, reflections.jsonl, etc.) | MEMORY system | Shared data layer. Written by hooks, read by Learning skill workflows |

### 4.2 Boundary Principle

The fundamental constraint governing this separation:

- **Hooks** own the CAPTURE layer (event-driven, runs on every prompt/session/stop)
- **Learning skill** owns the ANALYSIS layer (runs on demand, mines accumulated data)
- **PAIUpgrade skill** owns the EXTERNAL DISCOVERY layer (Anthropic, YouTube, GitHub, sources)
- **MEMORY** owns the DATA layer (JSONL files, learning directories, state files)

This follows the PAI architectural principle of separating concerns by lifecycle: hooks fire on events, skills fire on user intent, data persists across both.

---

## 5. New Skill Design

### 5.1 Name and Location

**Name:** `Learning`
**Location:** `Releases/v4.0.3/.claude/skills/Utilities/Learning/`

Rationale for "Learning" over alternatives:
- "LearningPipeline" -- too verbose, breaks the single-word naming convention most PAI skills follow
- "LearningSynthesis" -- implies only synthesis, but the skill also does raw mining and algorithm-targeted upgrades
- "Learning" -- matches what it does: analyze what PAI has learned from its own execution and ratings

### 5.2 Directory Structure

```
Releases/v4.0.3/.claude/skills/Utilities/Learning/
  SKILL.md                           # Skill definition + routing table
  Workflows/
    MineReflections.md               # Mine algorithm reflections for patterns
    MineRatings.md                   # Workflow wrapper for MineRatings.ts tool
    AlgorithmUpgrade.md              # Propose Algorithm spec changes from reflections
    Synthesize.md                    # Combined mining (reflections + ratings in parallel)
  Tools/
    MineRatings.ts                   # CLI tool: behavioral pattern analysis from ratings
```

### 5.3 SKILL.md Design

```markdown
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
  RatingCapture.hook.ts          MineReflections workflow
  WorkCompletionLearning.hook.ts MineRatings workflow/tool
  LoadContext.hook.ts            AlgorithmUpgrade workflow
  learning-readback.ts           Synthesize workflow
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
```

### 5.4 Synthesize.md Workflow Design

The Synthesize workflow replaces the inline Thread 3 from Upgrade.md. It runs MineReflections and MineRatings in parallel and produces a structured output that PAIUpgrade can consume directly for the Internal Signals section, or that can be used standalone.

**Input:** None required (reads data files directly).

**Output:** Structured report with two sections -- Algorithm Reflections analysis and Behavioral Signals from Ratings -- matching the Internal Signals output format currently defined in Upgrade.md lines 504-545.

**Invocation by PAIUpgrade:** The Upgrade workflow will instruct agents to "Read and follow `~/.claude/skills/Utilities/Learning/Workflows/Synthesize.md`" or use the Skill routing to invoke it.

---

## 6. Integration Points

### 6.1 PAIUpgrade Calls Learning Skill (Thread 3 Replacement)

**Current state (Upgrade.md lines 252-331):**
Thread 3 contains two inline agent prompts (80 lines total) that duplicate the logic of MineReflections.md and MineRatings.ts. The agent prompts include full instructions for reading JSONL files, clustering themes, grouping sessions, etc.

**After extraction:**
Replace lines 252-331 with a cross-skill delegation:

```markdown
### Step 2b: Launch Thread 3 - Internal Signal Mining

Spawn 1 agent alongside Threads 1 and 2:

Agent - Learning Synthesizer:
"Run the Synthesize workflow from the Learning skill.

Read and follow: ~/.claude/skills/Utilities/Learning/Workflows/Synthesize.md

Return the full output from that workflow.

EFFORT LEVEL: Return within 120 seconds."
```

This reduces 80 lines of inline instructions to ~10 lines of delegation and ensures the mining logic lives in one canonical place.

### 6.2 Internal Signals Output Template

The output template in Upgrade.md (lines 504-545) stays in place. It defines how Internal Signals appear in the Upgrade report. The Synthesize workflow's output is designed to match this template exactly, so the Upgrade workflow can slot it in without transformation.

### 6.3 AlgorithmUpgrade Cross-References

AlgorithmUpgrade.md reads both the Algorithm spec (`Releases/v4.0.3/.claude/PAI/Algorithm/v*.md`) and the reflections file. After extraction:
- The workflow moves to `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/AlgorithmUpgrade.md`
- It continues to read the Algorithm spec as a cross-reference (read-only)
- It continues to read reflections from the shared MEMORY data layer
- No imports or code paths change -- it operates on files, not modules

### 6.4 MineRatings Import Path Update

MineRatings.ts imports from `../../../../PAI/Tools/Inference.ts` (line 28). After moving to `Learning/Tools/MineRatings.ts`, the relative path needs updating:

```typescript
// BEFORE (from PAIUpgrade/Tools/):
import { inference } from '../../../../PAI/Tools/Inference.ts';

// AFTER (from Learning/Tools/):
import { inference } from '../../../../PAI/Tools/Inference.ts';
```

The relative depth is the same because both `PAIUpgrade` and `Learning` live under `skills/Utilities/`, so the path from `skills/Utilities/Learning/Tools/` to `PAI/Tools/` is identical to the path from `skills/Utilities/PAIUpgrade/Tools/`. No change needed.

---

## 7. Migration Steps

Ordered list of operations for implementing this extraction. Each step is independently verifiable.

### Phase 1: Create the Learning Skill (no modifications to PAIUpgrade yet)

| # | Action | File | Details |
|---|--------|------|---------|
| 1 | Create directory | `Releases/v4.0.3/.claude/skills/Utilities/Learning/` | `mkdir -p` |
| 2 | Create directory | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/` | `mkdir -p` |
| 3 | Create directory | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Tools/` | `mkdir -p` |
| 4 | Write SKILL.md | `Releases/v4.0.3/.claude/skills/Utilities/Learning/SKILL.md` | Per design in Section 5.3 |
| 5 | Copy MineReflections | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineReflections.md` | Copy from PAIUpgrade. Update voice notification curl to reference "Learning skill" instead of "PAIUpgrade skill". Update the "Integration with Upgrade Workflow" section at bottom to reference cross-skill invocation. |
| 6 | Copy AlgorithmUpgrade | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/AlgorithmUpgrade.md` | Copy from PAIUpgrade. Update voice notification curl to reference "Learning skill". Update "Integration Notes" section at bottom. |
| 7 | Copy MineRatings.ts | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Tools/MineRatings.ts` | Copy from PAIUpgrade. Verify import path for `Inference.ts` (should be unchanged -- same relative depth). |
| 8 | Write MineRatings.md | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineRatings.md` | New workflow wrapper: voice notification, invoke `bun Tools/MineRatings.ts`, handle output display, integration notes. |
| 9 | Write Synthesize.md | `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/Synthesize.md` | New workflow: spawns 2 parallel agents (reflection miner + ratings miner), collects results, produces combined Internal Signals output matching Upgrade.md template format. |

**Verification after Phase 1:**
- `ls Releases/v4.0.3/.claude/skills/Utilities/Learning/` shows SKILL.md, Workflows/, Tools/
- Each workflow has correct voice notification referencing Learning skill
- MineRatings.ts runs successfully: `bun Releases/v4.0.3/.claude/skills/Utilities/Learning/Tools/MineRatings.ts --all`
- The Learning skill triggers correctly on "mine reflections", "mine ratings", etc.

### Phase 2: Modify PAIUpgrade to Use Learning Skill

| # | Action | File | Details |
|---|--------|------|---------|
| 10 | Update SKILL.md routing table | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/SKILL.md` | Remove MineReflections, AlgorithmUpgrade rows from workflow routing table. Remove their triggers from the YAML description. Add note: "Internal signal mining is provided by the Learning skill." |
| 11 | Replace Thread 3 in Upgrade.md | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/Upgrade.md` | Replace lines 252-331 (inline agent prompts) with a delegation to `Learning/Workflows/Synthesize.md`. Keep the Internal Signals output template (lines 504-545) unchanged. |
| 12 | Update SKILL.md description | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/SKILL.md` | Remove learning-related trigger words from the YAML `description` field: "mine reflections", "algorithm upgrade". Keep: "upgrade", "improve system", "check Anthropic", "check YouTube", "find sources", "research upgrade". |

**Verification after Phase 2:**
- `grep -r "MineReflections" Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/SKILL.md` returns only a note, not a routing entry
- Upgrade.md Thread 3 is a delegation, not inline agent prompts
- "mine reflections" triggers the Learning skill, not PAIUpgrade
- "check for upgrades" still triggers PAIUpgrade and internally delegates to Learning for Thread 3

### Phase 3: Remove Duplicates from PAIUpgrade

| # | Action | File | Details |
|---|--------|------|---------|
| 13 | Delete MineReflections from PAIUpgrade | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` | Remove file (canonical version now in Learning) |
| 14 | Delete AlgorithmUpgrade from PAIUpgrade | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/AlgorithmUpgrade.md` | Remove file (canonical version now in Learning) |
| 15 | Delete MineRatings from PAIUpgrade | `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/MineRatings.ts` | Remove file (canonical version now in Learning) |

**Verification after Phase 3:**
- `ls Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/` shows only: Upgrade.md, ResearchUpgrade.md, FindSources.md
- `ls Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/` shows only: Anthropic.ts
- No broken references: `grep -r "MineReflections\|AlgorithmUpgrade\|MineRatings" Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/` shows only appropriate cross-skill references, not direct file references

### Phase 4: Documentation Updates

| # | Action | File | Details |
|---|--------|------|---------|
| 16 | Update PAI skill documentation | `Releases/v4.0.3/.claude/PAI/SKILLSYSTEM.md` or equivalent | Add Learning to the skill inventory if one is maintained |
| 17 | Update CONTEXT_ROUTING.md | `Releases/v4.0.3/.claude/PAI/CONTEXT_ROUTING.md` | Add Learning skill entry if skills are listed in context routing |

---

## 8. Issue #50 Relationship

Issue #50 ("Close the learning loop") asks for the learning system to actually apply what it learns. The fundamental constraint is ownership: before #50 can succeed, there must be a clear owner for learning analysis that is separate from external upgrade discovery.

**How this extraction enables #50:**

1. **Clear invocation target.** With a dedicated Learning skill, "close the loop" has a natural home. The workflow can be: (a) mine reflections + ratings, (b) identify top patterns, (c) propose and optionally apply changes to Algorithm spec, steering rules, or hook configurations. This pipeline lives entirely within the Learning skill.

2. **Standalone execution.** Currently, internal signal mining only runs as a side-thread of PAIUpgrade's Upgrade workflow. After extraction, it can run independently via "mine reflections" or "close the learning loop" -- no need to also check Anthropic sources and YouTube channels.

3. **Iteration cycle.** The Learning skill enables a tight iteration loop: mine -> propose -> apply -> observe -> mine again. PAIUpgrade's upgrade cycle is inherently different (external discovery -> evaluate -> integrate) and runs on a different cadence (weekly/monthly vs. per-session).

4. **AlgorithmUpgrade completes the loop.** AlgorithmUpgrade.md already has the logic to propose section-targeted patches to the Algorithm spec. Placing it in the Learning skill makes the full loop visible: reflections (data) -> mining (analysis) -> AlgorithmUpgrade (proposals) -> apply changes (action) -> new reflections (verification).

**Concrete #50 implementation path after extraction:**

- Add a new workflow to the Learning skill: `Apply.md` -- takes approved upgrade proposals from AlgorithmUpgrade and applies them to the Algorithm spec, bumping the version.
- Add a cron-triggerable entry point that runs Synthesize and, for high-confidence patterns (seen 5+ times, all HIGH signal), auto-applies without approval.
- Connect to the Algorithm's LEARN phase to close the full cycle: LEARN writes reflections -> Learning skill mines them -> Learning skill proposes changes -> changes land in the spec -> next LEARN phase reflects on the improved spec.

---

## 9. Open Questions

### 9.1 Requiring Input Before Implementation

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Should Learning live at `skills/Utilities/Learning/` or `skills/Learning/`?** | Top-level skills are for user-facing domains (Blogging, Research, Media). Utilities are for system-internal tools. | `skills/Utilities/Learning/` -- this is system infrastructure, not a user-facing domain skill. Consistent with PAIUpgrade being under Utilities. |
| 2 | **Should Synthesize.md be the default workflow?** | Could default to MineReflections (most common standalone use) or Synthesize (most comprehensive). | Default to Synthesize -- it runs both pipelines and is the most useful standalone invocation. MineReflections and MineRatings remain available as focused alternatives. |
| 3 | **Should the Upgrade workflow's Thread 3 delegation be an agent spawn or a direct Read?** | Agent spawn adds overhead but runs in parallel with Threads 1-2. Direct Read blocks. | Agent spawn (existing pattern). The value of Thread 3 is that it runs in parallel with external source collection. An agent reading and following Synthesize.md preserves this parallelism. |

### 9.2 For Future Consideration (Not Blocking)

| # | Question | Context |
|---|----------|---------|
| 4 | **Should the Learning skill eventually own the capture hooks too?** | Currently capture hooks are event-driven infrastructure. If the Learning skill grows to include active learning (not just analysis), capturing might logically belong to it. For now, keep them separate -- hooks and skills have different lifecycles. |
| 5 | **Should MineRatings produce persistent output files?** | Currently MineRatings.ts outputs to stdout only. For #50 (closing the loop), it may need to write actionable patterns to a persistent file that the Algorithm reads at startup. This is a #50 concern, not a #51 concern. |
| 6 | **Should the Learning skill declare `implements: Science`?** | Its methodology (mine -> hypothesize patterns -> verify with evidence -> propose changes) follows the scientific method. Consider adding `implements: Science` and `science_cycle_time: meso` to the SKILL.md YAML. |

---

## Appendix A: Line Count Summary

### Before Extraction

```
PAIUpgrade total:     3,326 lines
  SKILL.md:             492
  Upgrade.md:           744
  MineReflections.md:   163  (LEARNING)
  AlgorithmUpgrade.md:  237  (LEARNING)
  ResearchUpgrade.md:   208
  FindSources.md:       240
  MineRatings.ts:       363  (LEARNING)
  Anthropic.ts:         879

Learning lines:         763 lines  (23% of PAIUpgrade)
Non-learning lines:   2,563 lines  (77% of PAIUpgrade)
```

### After Extraction

```
PAIUpgrade total:     ~2,500 lines  (reduced by ~830 lines)
  SKILL.md:             ~470  (reduced routing table)
  Upgrade.md:           ~674  (Thread 3 reduced from 80 to ~10 lines)
  ResearchUpgrade.md:   208   (unchanged)
  FindSources.md:       240   (unchanged)
  Anthropic.ts:         879   (unchanged)

Learning total:        ~900 lines  (new skill)
  SKILL.md:             ~100  (new)
  MineReflections.md:   163   (moved)
  AlgorithmUpgrade.md:  237   (moved)
  MineRatings.md:       ~50   (new workflow wrapper)
  Synthesize.md:        ~80   (new, replaces inline Thread 3)
  MineRatings.ts:       363   (moved)
```

## Appendix B: File Reference (Repo-Relative Paths)

### Files to Create
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/SKILL.md`
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineReflections.md`
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/AlgorithmUpgrade.md`
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/MineRatings.md`
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/Workflows/Synthesize.md`
- `Releases/v4.0.3/.claude/skills/Utilities/Learning/Tools/MineRatings.ts`

### Files to Modify
- `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/SKILL.md`
- `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/Upgrade.md`

### Files to Delete (after copy confirmed)
- `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/MineReflections.md`
- `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Workflows/AlgorithmUpgrade.md`
- `Releases/v4.0.3/.claude/skills/Utilities/PAIUpgrade/Tools/MineRatings.ts`

### Files Unchanged (Hooks Infrastructure)
- `Releases/v4.0.3/.claude/hooks/RatingCapture.hook.ts`
- `Releases/v4.0.3/.claude/hooks/WorkCompletionLearning.hook.ts`
- `Releases/v4.0.3/.claude/hooks/LoadContext.hook.ts`
- `Releases/v4.0.3/.claude/hooks/lib/learning-readback.ts`
- `Releases/v4.0.3/.claude/hooks/lib/learning-utils.ts`

### Data Files (Runtime Only, Unchanged)
- `~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
- `~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl`
- `~/.claude/MEMORY/LEARNING/SIGNALS/mine-ratings-hwm.json`
- `~/.claude/MEMORY/STATE/learning-cache.sh`
