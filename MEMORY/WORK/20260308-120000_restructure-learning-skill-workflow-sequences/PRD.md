---
task: Restructure Learning skill workflow logical call sequences
slug: 20260308-120000_restructure-learning-skill-workflow-sequences
effort: standard
phase: complete
progress: 8/8
mode: interactive
started: 2026-03-08T12:00:00Z
updated: 2026-03-08T12:00:00Z
---

## Context

The Learning skill's 4 workflows have broken call chains. Synthesize duplicates MineReflections and MineRatings logic inline via agent prompts instead of composing the leaf workflows. MineRatings.md Integration section acknowledges the disconnect. AlgorithmUpgrade inlines reflection mining instead of referencing MineReflections.

Correct dependency graph:
```
MineReflections.md — LEAF (reads JSONL directly)
MineRatings.md — LEAF (calls MineRatings.ts CLI)
Synthesize.md — COMPOSITOR (delegates to MineReflections + MineRatings.ts)
AlgorithmUpgrade.md — COMPOSITOR (delegates to MineReflections + adds Algorithm routing)
```

### Risks
- AlgorithmUpgrade adds legitimate value (section routing table) on top of MineReflections — must preserve that

## Criteria

- [x] ISC-1: Synthesize Ratings agent calls MineRatings.ts CLI
- [x] ISC-2: Synthesize Reflection agent references MineReflections.md not inline logic
- [x] ISC-3: Synthesize diagram reflects correct call chain
- [x] ISC-4: MineRatings.md Integration section says Synthesize calls CLI tool
- [x] ISC-5: AlgorithmUpgrade Step 2 references MineReflections.md as base
- [x] ISC-6: AlgorithmUpgrade preserves Algorithm section routing table
- [x] ISC-7: SKILL.md architecture diagram reflects correct composition
- [x] ISC-8: No workflow duplicates logic from another workflow

## Decisions

## Verification
