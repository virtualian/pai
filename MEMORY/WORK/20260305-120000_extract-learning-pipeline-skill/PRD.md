---
task: Extract learning pipeline into dedicated skill
slug: 20260305-120000_extract-learning-pipeline-skill
effort: extended
phase: complete
progress: 16/16
mode: interactive
started: 2026-03-05T12:00:00-08:00
updated: 2026-03-05T12:05:00-08:00
---

## Context

Issue #51 asks to extract the learning pipeline from PAIUpgrade into a dedicated skill. PAIUpgrade currently mixes two distinct concerns: external source monitoring/system upgrades (~69% of code) and internal learning pipeline analysis (~31%). The learning pipeline (MineReflections, MineRatings, AlgorithmUpgrade, Thread 3 of Upgrade) has its own lifecycle and data model that shouldn't be coupled to external upgrade discovery.

Issue #50 ("Close the learning loop") depends on this extraction for clear ownership of the learning pipeline before it can convert patterns into imperative behavioral rules.

### Risks

- Thread 3 of Upgrade.md integrates learning signals into upgrade reports — severing it requires a clean integration point
- The learning skill must own analysis/synthesis but NOT the capture hooks (RatingCapture, WorkCompletionLearning) which are infrastructure
- Existing reports show the pipeline has gaps (ReflectionCapture hook missing, MineRatings existed but was never merged upstream)

## Criteria

- [x] ISC-1: Investigation identifies all learning-related components in PAIUpgrade
- [x] ISC-2: Investigation identifies all non-learning components remaining in PAIUpgrade
- [x] ISC-3: MineReflections workflow extraction plan documented
- [x] ISC-4: MineRatings.ts tool extraction plan documented
- [x] ISC-5: AlgorithmUpgrade workflow extraction plan documented
- [x] ISC-6: Upgrade.md Thread 3 decoupling strategy documented
- [x] ISC-7: Hook ownership boundary defined (capture vs analysis)
- [x] ISC-8: New skill naming decision made with rationale
- [x] ISC-9: New skill directory structure defined following canonical pattern
- [x] ISC-10: SKILL.md routing table designed for new skill
- [x] ISC-11: Integration point between new skill and PAIUpgrade defined
- [x] ISC-12: Files requiring modification listed with specific changes
- [x] ISC-13: Issue #50 dependency relationship clarified
- [x] ISC-14: Readback system ownership determined (hooks/lib/learning-readback.ts)
- [x] ISC-15: Data storage paths ownership mapped (MEMORY/LEARNING/*)
- [x] ISC-16: Investigation report written as deliverable on the branch

## Decisions

- **Skill name:** "Learning" — concise, matches PAI naming convention, describes the domain
- **Location:** `skills/Utilities/Learning/` — system infrastructure, not user-facing domain
- **AlgorithmUpgrade belongs in Learning** — its INPUT is learning data, its PURPOSE is learning-driven improvement
- **Hook ownership:** Capture hooks stay as infrastructure; Learning skill owns analysis workflows only
- **Readback stays in hooks:** learning-readback.ts is used by LoadContext hook, not by skills
- **Thread 3 becomes delegation:** 80 lines of inline agent prompts replaced by ~10 lines calling Learning/Synthesize
- **Data files unchanged:** MEMORY/LEARNING/* paths remain shared between hooks (writers) and Learning skill (readers)

## Verification

- ISC-1: Report Section 2.1 lists 4 learning components with file paths and line counts (843 lines total)
- ISC-2: Report Section 2.2 lists 10 non-learning components (2,483 lines total)
- ISC-3: Report Section 3.1 + Migration Phase 1 Step 5 — copy with voice notification update
- ISC-4: Report Section 3.1 + Migration Phase 1 Steps 7-8 — copy tool, create workflow wrapper
- ISC-5: Report Section 3.1 + Migration Phase 1 Step 6 — copy with voice notification update
- ISC-6: Report Section 6.1 — replace inline prompts with cross-skill delegation to Synthesize.md
- ISC-7: Report Section 4.1 ownership table + Section 4.2 boundary principle
- ISC-8: Report Section 5.1 — "Learning" with rationale against alternatives
- ISC-9: Report Section 5.2 — SKILL.md + Workflows/ + Tools/ with 6 files
- ISC-10: Report Section 5.3 — 4-row routing table (MineReflections, MineRatings, AlgorithmUpgrade, Synthesize)
- ISC-11: Report Section 6.1 — Thread 3 delegation pattern with code example
- ISC-12: Report Section 7 — 17 ordered steps across 4 phases with verification criteria + Appendix B file list
- ISC-13: Report Section 8 — extraction enables standalone execution, tight iteration, Apply.md workflow path
- ISC-14: Report Section 4.1 — learning-readback.ts stays in hooks infrastructure (used by LoadContext)
- ISC-15: Report Section 2.4 + Section 4.1 — data files owned by MEMORY system, written by hooks, read by Learning skill
- ISC-16: Report written at `reports/issue-51-learning-pipeline-extraction.md` (564 lines)
