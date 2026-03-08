# v4.0.2: Learning pipeline dead ends — reflections never captured, ratings never analyzed

## Summary

On a fresh v4.0.2 install, two of three learning pipelines are dead ends:

1. **Algorithm reflections** — the LEARN phase (v3.5.0, lines 293-306) produces Q1-Q4 reflections in every Standard+ run, but no Stop hook captures them. `algorithm-reflections.jsonl` is never written to. The MineReflections workflow, AlgorithmUpgrade workflow, and Upgrade workflow all read from this file — they ship ready to go but will always find 0 entries.

2. **Rating analysis** — `RatingCapture.hook.ts` correctly writes to `ratings.jsonl` on every `UserPromptSubmit`, but no tool exists to analyze the accumulated data. Ratings accumulate indefinitely with no consumer.

The third pipeline (work completion learnings via `WorkCompletionLearning.hook.ts`) works end-to-end.

## Reproduction

Fresh v4.0.2 install. No local modifications.

1. Run any Algorithm session at Standard+ effort. Observe LEARN phase produces Q1-Q4 reflections in output.
2. Check `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl` — file does not exist or is empty.
3. Run "mine reflections" — MineReflections workflow reports 0 entries.
4. Give several explicit ratings (e.g. "7/10"). Confirm `MEMORY/LEARNING/SIGNALS/ratings.jsonl` accumulates entries.
5. Search for any tool or workflow that reads `ratings.jsonl` for pattern extraction — none exists.

## Root cause

v3.0 used `StopOrchestrator.hook.ts` as the single Stop hook, dispatching to handlers including a planned `ReflectionCapture`. However, `ReflectionCapture.ts` was never included in the v3.0 release — the import on line 31 of `StopOrchestrator.hook.ts` references a file that doesn't ship, which crashes the entire orchestrator on a vanilla v3.0 install (Bun fails at module resolution for missing static imports).

v4.0 replaced StopOrchestrator with four independent Stop hooks (LastResponseCache, ResponseTabReset, VoiceCompletion, DocIntegrity). These work correctly, but the reflection capture capability was not ported to a standalone hook.

For ratings, no analysis tool has ever shipped. The capture side (`RatingCapture.hook.ts`) works; the analysis side was proposed in PR #735 but not merged.

## What ships but has no data source

| Component | Location | Reads from | Status |
|-----------|----------|------------|--------|
| MineReflections workflow | `skills/Utilities/PAIUpgrade/Workflows/MineReflections.md` | `algorithm-reflections.jsonl` | Starved — file never written |
| AlgorithmUpgrade workflow | `skills/Utilities/PAIUpgrade/Workflows/AlgorithmUpgrade.md` | `algorithm-reflections.jsonl` | Starved |
| Upgrade workflow (Thread 3) | `skills/Utilities/PAIUpgrade/Workflows/Upgrade.md` | `algorithm-reflections.jsonl` | Starved |
| MEMORYSYSTEM docs | `PAI/MEMORYSYSTEM.md` lines 57, 140 | Documents `algorithm-reflections.jsonl` schema | Describes a file that's never populated |
| SKILL.md instruction | `PAI/SKILL.md` line 346 | Tells model to write JSONL | No hook enforces this |

## What's needed

Two components, neither of which exists in any release:

**1. A ReflectionCapture Stop hook** — standalone `.hook.ts` (v4.0 pattern). On every Stop: parse transcript, check for LEARN phase markers, extract Q1-Q3 reflections, append structured JSONL to `algorithm-reflections.jsonl`. Deduplication by session_id. This unblocks MineReflections, AlgorithmUpgrade, and the Upgrade workflow.

**2. A MineRatings tool** — CLI tool that reads `ratings.jsonl`, clusters by score band, extracts behavioral patterns (via Haiku inference or similar), and produces actionable recommendations. This closes the feedback loop from rating capture to corrective action.

## Prior work

| Reference | What happened |
|-----------|--------------|
| [Discussion #531](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/531) | "Is the Learning System Actually Learning?" — opened Jan 29, 10 comments. Daniel confirmed the gap (Jan 30): *"the final piece of applying the learnings and doing the matching is not happening natively."* Claimed v3.0 fixed it (Feb 18). Community reported zero reflections post-v3.0 migration (Feb 20). No response since. |
| [PR #735](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/735) | `MineRatings.ts` + `ReflectionCapture.hook.ts` — +734 lines. Closed Feb 25 without merge or comment. |
| [PR #733](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/733) | `MineRatings.ts` standalone — closed Feb 19, superseded by #735. |
| [PR #404](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/404) | Learning capture + pre-flight check — closed Feb 10 without merge. |
| [Discussion #632](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/632) | "Closing the Learning Loop" — 3-level proposal. Marked resolved pointing to v3.0. |
| [Discussion #693](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/693) | Community workaround via manual steering rules, acknowledging the system is "write-only". |
| [Issue #700](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/700) | PRD persistence skipped — cross-references same pattern with `algorithm-reflections.jsonl`. |
