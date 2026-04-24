# Issue #148 — Specialized Subagent Probe Report

**Date:** 2026-04-22
**Purpose:** Resolve §8 item 6 of the issue #143 design report — verify whether specialized subagent types (`Architect`, `Engineer`, `Plan`) have `AskUserQuestion` in their default tool set, as an extension of the investigation's confirmed finding that `general-purpose` does not.

## Method

Three `Task`/`Agent` invocations, one per subagent type, issued in parallel from the primary DA inside session `2522b30f-4599-4923-a8d3-c429f3916dd0`. Each received an identical introspection prompt asking for a single JSON object reporting:

- `askuserquestion_status` — `PRESENT` iff `AskUserQuestion` is in the top-level tool list (callable without `ToolSearch`).
- `toolsearch_visible` — `YES` iff `AskUserQuestion` is listed as deferred-loadable via `ToolSearch`, `NO` if not listed as deferred, `UNKNOWN` if the agent cannot verify.
- `all_tool_names` — the list of top-level tool names the agent can invoke directly.

The probe prompt explicitly forbade any tool invocation beyond self-introspection. Identical prompt text across the three agents (differing only in the `subagent_type` field) satisfies ISC-28a.

## Results

```json
{
  "subagent_type": "Architect",
  "askuserquestion_status": "ABSENT",
  "toolsearch_visible": "UNKNOWN",
  "all_tool_names": ["Bash", "Edit", "Read", "ScheduleWakeup", "Skill", "ToolSearch", "Write"]
}
```

```json
{
  "subagent_type": "Engineer",
  "askuserquestion_status": "ABSENT",
  "toolsearch_visible": "UNKNOWN",
  "all_tool_names": ["Bash", "Edit", "Read", "ScheduleWakeup", "Skill", "ToolSearch", "Write"]
}
```

```json
{
  "subagent_type": "Plan",
  "askuserquestion_status": "ABSENT",
  "toolsearch_visible": "UNKNOWN",
  "all_tool_names": ["Bash", "Read", "ScheduleWakeup", "Skill", "ToolSearch"]
}
```

## Summary

| Subagent type   | AskUserQuestion present | ToolSearch present | Notes |
|-----------------|:-----------------------:|:------------------:|------|
| Architect       | No                      | Yes                | Has Bash/Edit/Write/Read/Skill/ScheduleWakeup |
| Engineer        | No                      | Yes                | Identical top-level set to Architect |
| Plan            | No                      | Yes                | Read-only: no Bash/Edit/Write |
| general-purpose | No (from #143)          | No (from #143)     | Pre-existing finding from the investigation; report §4.3 |

`toolsearch_visible: UNKNOWN` across all three reflects that the introspection prompt could not verify whether `AskUserQuestion` is listed in the deferred-tools system-reminder block without actually calling `ToolSearch`. The probe intentionally forbade that call to keep introspection side-effect-free.

## Implications

1. **Design option §4.3(a) (direct subagent invocation of `AskUserQuestion`) is foreclosed across every specialized subagent type tested.** There is no type for which enabling direct invocation is a simple tool-allowlist addition — the tool is not in the top-level list for any of them.
2. **Bubble protocol (§4.3b) is the only workable path** for structured user-choice from subagent context. This is what `PAI/PROTOCOLS/qa-contract.md` and the new `THEDELEGATIONSYSTEM.md` "User-choice bubbling" subsection formalize.
3. **`Plan` subagent is further restricted** — absence of `Bash`, `Edit`, `Write` means it cannot even file-log a pending choice. Its only Carrier-A surface is the return value of the `Task` invocation.
4. **`ToolSearch` availability** across Architect/Engineer/Plan means *if* `AskUserQuestion` were added to their deferred-tools list by the harness, it could be loaded on-demand from a subagent context. That would be a future-compatible path to enabling §4.3(a) selectively; it does not change the present-day picture.

## Verification status (ties to PRD)

- ISC-28: Architect probed — ✅ `all_tool_names` captured
- ISC-28a: Identical introspection template across all three — ✅ (prompt text diffs only in `subagent_type` literal)
- ISC-29: Engineer probed — ✅
- ISC-30: Plan probed — ✅
- ISC-31: Results written to this file — ✅
