---
task: Implement learning pipeline — ReflectionCapture handler and MineRatings tool
slug: 20260301-231500_learning-pipeline
effort: Advanced
phase: complete
progress: 26/26
mode: algorithm
started: 2026-03-01T23:15:00+00:00
updated: 2026-03-01T23:15:00+00:00
---

## Context

Issue #26 requires implementing two components that close the learning feedback loop:

1. **ReflectionCapture handler** — A Stop hook that extracts Q1/Q2/Q3 reflections from the Algorithm LEARN phase and writes structured JSONL to `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`
2. **MineRatings tool** — A CLI tool that mines `ratings.jsonl` to extract behavioral patterns via Haiku inference

### Architecture Decision
The v4.0.1 architecture uses individual Stop hooks (not a StopOrchestrator). ReflectionCapture will be implemented as its own Stop hook (`ReflectionCapture.hook.ts`) that reads stdin, parses the transcript, and calls the handler — following the same pattern as `VoiceCompletion.hook.ts`.

The handler already exists in `~/.claude/hooks/handlers/ReflectionCapture.ts` (the live install) but NOT in the v4.0.1 release. We need to add both the hook wrapper and the handler to the release, plus wire it into settings.json.

MineRatings follows the Anthropic.ts tool pattern in `skills/Utilities/PAIUpgrade/Tools/`.

### Not wanted
- No StopOrchestrator (v4.0.1 doesn't use one)
- No changes to Algorithm prompt
- No breaking existing hooks
- No direct @anthropic-ai/sdk imports

### Risks
- algorithm-state.ts lib doesn't exist in v4.0.1 release — ReflectionCapture needs metadata from Algorithm state (criteria counts, effort level, task description). Must either create the lib or extract metadata directly from the transcript text.
- MineRatings depends on ratings.jsonl schema which has no formal spec — must match actual RatingEntry interface from RatingCapture.hook.ts.

### Plan
1. Create `hooks/handlers/ReflectionCapture.ts` — extract reflections from parsed transcript, write JSONL
2. Create `hooks/ReflectionCapture.hook.ts` — Stop hook wrapper (stdin → parse → handler)
3. Wire ReflectionCapture into settings.json Stop hooks array
4. Create `skills/Utilities/PAIUpgrade/Tools/MineRatings.ts` — CLI tool with --dry-run, --all, --since flags
5. Add MineRatings workflow to PAIUpgrade Workflows

## Criteria

### ReflectionCapture Handler
- [x] ISC-1: ReflectionCapture.ts handler file exists in hooks/handlers/
- [x] ISC-2: Handler exports async handleReflectionCapture(parsed, sessionId)
- [x] ISC-3: Handler extracts Q1 reflection from both bold and dash formats
- [x] ISC-4: Handler extracts Q2 reflection from both bold and dash formats
- [x] ISC-5: Handler extracts Q3 reflection from both bold and dash formats
- [x] ISC-6: Handler extracts LEARNING line from response text
- [x] ISC-7: Handler detects LEARN phase via "LEARN" + "7/7" or "━━━" markers
- [x] ISC-8: Handler skips non-Algorithm responses silently (no error)
- [x] ISC-9: Handler deduplicates by session_id in existing JSONL
- [x] ISC-10: JSONL entry matches MineReflections expected schema (12 fields)
- [x] ISC-11: Handler creates REFLECTIONS directory if missing
- [x] ISC-12: Handler appends to algorithm-reflections.jsonl (not overwrites)

### ReflectionCapture Hook Wrapper
- [x] ISC-13: ReflectionCapture.hook.ts exists in hooks/ directory
- [x] ISC-14: Hook reads stdin via readHookInput() from lib/hook-io
- [x] ISC-15: Hook parses transcript via parseTranscriptFromInput()
- [x] ISC-16: Hook calls handleReflectionCapture(parsed, session_id)
- [x] ISC-17: Hook exits cleanly on error (exit 0, never crashes)

### Settings Integration
- [x] ISC-18: settings.json Stop hooks array includes ReflectionCapture.hook.ts

### MineRatings Tool
- [x] ISC-19: MineRatings.ts exists in skills/Utilities/PAIUpgrade/Tools/
- [x] ISC-20: Tool reads ratings.jsonl from MEMORY/LEARNING/SIGNALS/
- [x] ISC-21: Tool supports --dry-run flag (shows what would be analyzed)
- [x] ISC-22: Tool supports --all flag (analyze all entries)
- [x] ISC-23: Tool supports --since N flag (entries from last N days)
- [x] ISC-24: Tool uses Inference.ts with fast level for pattern extraction
- [x] ISC-25: Tool tracks high-water-mark timestamp for incremental runs
- [x] ISC-26: Tool outputs behavioral patterns as stop/do-more recommendations

### Anti-criteria
- [x] ISC-A1: No direct @anthropic-ai/sdk imports anywhere
- [x] ISC-A2: No modifications to existing hook files (only additions)

## Decisions

## Verification

All 26 ISC + 2 anti-criteria verified. Files transpile cleanly. Git diff confirms only additions + 4-line settings.json insertion.
