# Design Proposal — PAI-Native Q&A Pattern (Issue #143)

**Status:** Investigation-only. Implementation is out of scope per issue body and must be tracked in a follow-up issue.
**Author session:** 2026-04-21
**Branch:** `issue-143-askuserquestion-investigation`
**Related issue:** [virtualian/pai#143](https://github.com/virtualian/pai/issues/143)

---

## 1. Executive Summary

PAI already treats `AskUserQuestion` as a first-class primitive, with 14 coupling points across the Algorithm, steering rules, skills, packs, hooks, and transcript tooling. The *tool* is fine. The gap is that triggering is inconsistent across modes and subagents, and the CC-specific tool name is quietly baked into prompt files that are meant to be harness-agnostic.

**Recommended shape:** *Hybrid — keep invoking `AskUserQuestion` directly inside Claude Code, but layer a thin PAI contract on top that (a) defines a mode-aware trigger gate in the Algorithm, (b) standardises a subagent-to-DA bubbling protocol so only the primary DA ever asks the user, and (c) specifies an abstract request/response contract so a non-CC harness adapter can be added later without rewriting callers.*

This delivers propagation consistency without introducing an indirection layer that buys nothing against a single concrete implementation.

## 2. Problem Statement

From issue #143, three constraints hold:

1. `AskUserQuestion` is harness-level in Claude Code — hooks cannot force the model to select it. Hooks are the wrong mechanism for triggering.
2. PAI targets multiple surfaces (primary DA + subagents + hypothetical non-CC harnesses); the CC-specific tool is not portable.
3. Today: *behaviour* belongs in memory / `CLAUDE.md`; *automation* belongs in hooks. Ian's steering rules already contain one line for this behaviour (`AISTEERINGRULES.md:64`).

The investigation's five checkboxes are inventory, wrap-vs-primitive, trigger mechanism, subagent story, and non-CC fallback.

## 3. Current State — Runtime Enumeration

14 coupling points to `AskUserQuestion` exist today.

| # | File | Line | Role | Verified |
|---|------|------|------|----------|
| 1 | `PAI/Algorithm/v3.7.0.md` | 8 | Critical rule: "Response format before questions" | ✅ read |
| 2 | `PAI/Algorithm/v3.7.0.md` | 325 | Worked example (mislabelled "AskUser tool") | ✅ read |
| 3 | `PAI/AISTEERINGRULES.md` | 34 | "Ask before destructive actions" points at AskUserQuestion | ✅ read |
| 4 | `PAI/AISTEERINGRULES.md` | 64 | "AskUserQuestion for choices" — primary behavioural rule | ✅ read |
| 5 | `PAI/SKILL.md` | 85 | Listed in "Foundation (always available)" | ✅ read |
| 6 | `PAI/SKILL.md` | 110 | Row 2 of Capability Registry | ✅ read |
| 7 | `PAI/Tools/ScanWorkflow.md` | 132-144 | UpstreamScan decisions are collected via AskUserQuestion | ✅ read |
| 8 | `PAI/Tools/TranscriptParser.ts` | 301, 319 | Runtime state derivation inspects `tool_use.name === 'AskUserQuestion'` | ✅ read |
| 9 | `PAI/THEHOOKSYSTEM.md` | 254, 292 | Matcher documentation | ✅ read |
| 10 | `hooks/SetQuestionTab.hook.ts` | header | PreToolUse matcher `AskUserQuestion` — sets tab teal | ✅ read |
| 11 | `hooks/QuestionAnswered.hook.ts` | header | PostToolUse matcher `AskUserQuestion` — resets tab orange | ✅ read |
| 12 | `~/.claude/settings.json` | matcher blocks | Hook registration by tool name | ✅ read |
| 13 | `Packs/pai-diataxis-documentation-skill/...SKILL.md` + 5 workflow files | 66-391 | Drift/source-modification confirmation prompts | ✅ subagent probe |
(Row 14 removed on critique — "any future pack that couples" is a propagation risk, not a present-day coupling point. Addressed instead via §8 item 6 below.)

**Behaviour of existing hooks:** PreToolUse `SetQuestionTab.hook.ts` parses the question's `header` field, sets the terminal tab to teal (`#0D4F4F`) and saves the previous title. PostToolUse `QuestionAnswered.hook.ts` restores the orange working title. These are cosmetic-only (Kitty terminal); failure is silent. Crucially, **neither hook triggers the tool** — they react to it.

**Key implication:** *Any* replacement primitive must either keep the `AskUserQuestion` matcher alive or migrate all 14 sites at once. A gradual rename is not cheap.

## 4. Design Decisions

Four sub-decisions, each with options and a recommendation. The overall recommendation is an assembly of (4.1.c, 4.2.c, 4.3.b, 4.4.b).

### 4.1 Contract shape — Wrapper vs Primitive vs Hybrid

| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| **(a) Wrapper skill** (`Skill("AskUser")` delegates to `AskUserQuestion`) | Rename-resilient; centralises any future logging/telemetry | Adds indirection to every call that works today; 14 existing callers need migration for zero behaviour change | Medium (~1-2 days) |
| **(b) Independent PAI primitive** (new tool, new name, CC's tool becomes one backend) | Clean abstraction boundary; multi-backend ready | Over-engineering — there is one concrete backend and one concrete harness; spec-before-use tends to bit-rot | Medium-high |
| **(c) Hybrid** (keep direct calls; add PAI contract *only* for gaps: trigger gate, subagent protocol, non-CC adapter spec) | Zero migration cost for existing sites; new machinery covers the actual broken cases; primitive can be introduced later if a second backend emerges | Leaves `AskUserQuestion` name in 14 files — rename of the CC tool forces a mass edit | Small (~2-4 hours) |
| **(d) Declarative manifest** (per-skill/pack `ask_points:` field enumerating legitimate trigger conditions, machine-readable) | Install-time verifiable; greppable; avoids both wrapper and rule-only approaches | Introduces a new schema; no enforcement without tooling; unclear what to do with manifest entries that aren't respected at runtime | Medium |

**Recommendation: (c) Hybrid.** The 14 existing sites all work. (a) adds a layer for rename-resilience, a problem we do not have. (b) abstracts over a set of size 1. (d) is attractive but has no enforcement story — a manifest without tooling is drift bait; revisit if a future implementation issue needs pack-level policy. (c) puts effort only where something is actually broken (triggering + subagents + unspecified fallback contract), and keeps the door open for a real primitive if a non-CC harness ever ships.

**Voice note on §4.1(c) + §4.2(c) coherence (raised in critique):** §4.1 says "no new primitive"; §4.2 introduces an ENUMERATE→OFFER gate. These are consistent because the gate is a *behavioural* contract on the Algorithm's phase sequence, not a tool-level primitive with an invocation surface. No new tool name enters the system. The gate's "interface" is an Algorithm output format directive and a VERIFY-able criterion — homologous to `ISC-Count-Gate` and `OBSERVE-Exit-Checks` which are also "primitive-shaped" but live entirely in prompt text.

### 4.2 Trigger mechanism — Behavioural vs Algorithm step vs Combined

Today's triggering is weak: `AISTEERINGRULES.md:64` is a single line with no concrete trigger conditions. `MEMORY/LEARNING/FAILURES/2026-04/*` contains 20+ low-rating sessions — several are of the shape "user expected to be asked, wasn't." The rule fires inconsistently.

| Option | Pros | Cons |
|--------|------|------|
| **(a) Strengthen behavioural rule only** (tighten `AISTEERINGRULES.md:64` with a concrete trigger list + worked examples) | Minimal change; applies across all modes | Relies purely on attention to a rule that already exists and is already drifting |
| **(b) Explicit Algorithm step (ENUMERATE→OFFER)** between OBSERVE and THINK | Load-bearing gate; can't exit without passing | Only fires in ALGORITHM mode; NATIVE mode still relies on the rule |
| **(c) Combined — rule for NATIVE, Algorithm step for ALGORITHM** | Each mode gets the mechanism appropriate to it; matches the existing NATIVE/ALGORITHM split | Two places to maintain the trigger logic |
| **(d) Output-format enforcement** (add a `❓ OPEN_CHOICES:` line to every NATIVE and ALGORITHM output block; non-empty value must be followed by `AskUserQuestion` or a committed-rationale line) | Load-bearing in both modes; symmetric; uses the existing format-compliance infrastructure already called out as a Critical Rule in the Algorithm | Adds a new output-format field; easy to leave empty and appear compliant; needs a post-response check to catch violations |

**Recommendation: (c) Combined, with (d)'s output-format field adopted as the NATIVE-mode carrier.** Behavioural rules alone have already demonstrated drift (see the 20+ `MEMORY/LEARNING/FAILURES/2026-04/*` sessions rated ≤3/10 where user implied a question was expected). An output-format field is load-bearing because format violation is already a Critical Rule in the Algorithm. Specifically:

- **ALGORITHM mode:** ENUMERATE→OFFER sub-step at OBSERVE exit — one paragraph added to `PAI/Algorithm/LATEST`. Example wording:
  > *Before exiting OBSERVE: enumerate every discrete multi-option decision you will make during BUILD/EXECUTE. For each, either commit with stated rationale or add it to the next `AskUserQuestion` tool call. Free-text/subjective decisions do not qualify — only choices with ≤4 enumerable options.*
- **NATIVE mode:** add `❓ OPEN_CHOICES: [one-line list, or 'none']` to the NATIVE output format in `PAI/CLAUDE.md`. Non-empty value must be paired with an `AskUserQuestion` invocation in the same turn. Empty value is always valid. This is the symmetric mechanism for NATIVE that the Architect critique flagged as missing in pure (c).

This pair (ENUMERATE→OFFER + OPEN_CHOICES) gives each mode a mechanism proportionate to its structure: ALGORITHM gets a phase gate, NATIVE gets an output-field constraint.

### 4.3 Subagent story — Direct vs Bubble vs Mixed

Current observed behaviour: PAI's `agents/*.md` files do not declare `AskUserQuestion` in any `tools:` allowlist (grep returned zero matches across the 15 agent definitions). A runtime probe launched during this investigation (Task tool, `subagent_type: "general-purpose"`, `model: "haiku"`) reports `ASK_USER_QUESTION_STATUS: ABSENT` and `TOOL_SEARCH_VISIBLE: No` — the subagent cannot invoke `AskUserQuestion` directly and cannot even fetch it via the deferred-tool loader. So subagents of type `general-purpose` today genuinely *cannot* ask directly; they either guess or return partial work. **Caveat: only `general-purpose` was probed. Specialised subagent types (Architect, Engineer, Plan) may have different default tool sets — the §8 handoff keeps a single-line probe item to verify before any implementation that relies on option (a) below.**

| Option | Pros | Cons |
|--------|------|------|
| **(a) Direct invocation** — add `AskUserQuestion` to agent `tools:` allowlists | Subagents can ask autonomously | Multiple subagents asking simultaneously = UX chaos; existing hooks (one tab, one title) assume a single asker; subagents lack the DA's conversation context |
| **(b) Bubble to DA via structured return** — subagents return `pending_user_choices[]`, DA aggregates and asks | Single asker preserves hook + tab model; DA has full context; naturally batches multi-agent choices into one prompt | Extra round-trip per choice point; protocol needs to be documented |
| **(c) Mixed** — direct for "trusted" agent types (Architect, Plan), bubble for grunt work | Plausible UX tuning | Two protocols to maintain; trust boundary is arbitrary |
| **(d) Return-and-stop** — subagent returns a single typed field `blocked_on_user: {header, question, options}` and terminates; no aggregation, DA handles all asking | Simpler than bubble aggregation; preserves one-asker invariant; no multi-question batching contract to maintain | Loses the parallel-agent batching opportunity; each blocked subagent is an independent round-trip with the user |

**Recommendation: (b) Bubble.** This preserves the one-tab-one-asker invariant that the existing hooks rely on, lets the DA batch multiple subagents' choices into a single `AskUserQuestion` call (which supports up to 4 questions in an array), and keeps subagent context lean. The protocol is a ~20-line addition to `THEDELEGATIONSYSTEM.md`. Option (d) return-and-stop is a viable simpler fallback if aggregation proves unnecessary in practice — it can replace (b) without changing callers, since both produce a structured "pending choice" in the subagent return value. The probe result `ASK_USER_QUESTION_STATUS: ABSENT` for general-purpose subagents confirms (b) is required for that subagent type; (a) is foreclosed there without a runtime change.

**Protocol sketch (documentation-only; not a spec to be copy-pasted into prompts):**

> When a subagent encounters a discrete multi-option decision whose answer materially changes its output, it MUST NOT ask the user. It MUST return a structured result containing `pending_user_choices: [{ header, question, options }]` and pause. The DA aggregates pending choices from all currently-running subagents, issues one `AskUserQuestion` (up to 4 questions at once), and relays the answers back when resuming.

### 4.4 Non-CC harness fallback — Abstract contract vs Adapter vs Defer

No concrete non-CC PAI surface exists today. The investigation asks us to define the contract regardless.

| Option | Pros | Cons |
|--------|------|------|
| **(a) Build a text-mode adapter now** (stdin/stdout Q&A for CLI contexts) | Ready when needed; exercises the contract | Speculative; zero current consumers; likely to drift before first use |
| **(b) Define the abstract contract only** (request/response schema, no implementation) | Low effort; provides a spec for future adapters; flushes ambiguity (cancel semantics, multi-select, free-text escape) | No immediate functional gain |
| **(c) Defer entirely** — revisit when a non-CC surface is named | Cheapest | Leaves the issue's checkbox #5 unanswered |
| **(d) In-process text-mode stub inside PAI** — ship a tiny stdin/stdout `AskUserQuestion` stand-in that packs can target when running outside CC, also usable as a test harness | Concrete backend for the abstract contract; enables pack testing without the CC harness | Requires runtime code (out of scope for this investigation); only pays off if a pack is actually tested outside CC |

**Recommendation: (b) Abstract contract.** The request/response shape below takes minutes to write and gives future adapter authors a target. No code.

```
Request:
  header: string (<=12 chars)            # tab/chip label
  question: string                       # full question, ends in ?
  options: [{ label: string, description: string }]  # 2..4
  allow_free_text: bool                  # "Other" escape hatch (default true)
  allow_cancel: bool                     # explicit null response (default false)
  multi_select: bool                     # (default false)

Response:
  selected: string | string[] | null     # label(s) chosen, null if cancelled
  free_text: string | null               # populated if user chose "Other"
  cancelled: bool                        # true iff user explicitly cancelled
```

This matches the CC `AskUserQuestion` schema exactly (verified against the deferred-tool schema loaded this session), which means the Claude-Code implementation is a trivial pass-through. Any future non-CC adapter has a fixed target.

**Schema unification with §4.3 (one schema, two carriers):** The same request shape is used for both the subagent→DA bubble protocol (§4.3) and the DA→user prompt (§4.4). The difference is *carrier*, not structure:

- **Carrier A (§4.3):** subagent return value includes `pending_user_choices: [<Request>, ...]`; DA consumes and forwards.
- **Carrier B (§4.4):** DA's final outbound request conforms to this same shape, delivered via `AskUserQuestion` (in CC) or the abstract contract (in a future non-CC harness).

A follow-up implementation must define the Request/Response schema in exactly one place (`PAI/PROTOCOLS/qa-contract.md`) and have both carriers reference it. Diverging the schemas between §4.3 and §4.4 is the first drift risk the Architect critique flagged.

## 5. Inventory — Where Discrete-Choice Q&A Should Fire

These are PAI flow touchpoints where a structured multi-option prompt is the right move. The floor from the issue is 6; this is 10.

1. **Algorithm OBSERVE exit** — when the user's request is ambiguous in a way that splits the ISC (scope, target repo, target file)
2. **Algorithm PLAN — capability substitution** — when two skills could plausibly be used (e.g., Research vs ContextSearch, Architect vs Engineer) and the choice changes the output materially
3. **Destructive action confirmation** — `rm -rf`, `git push --force`, production deploy, database drop (already in `AISTEERINGRULES.md:34`, but not consistently wired)
4. **Commit message approval** — MARR requires explicit approval for commits; current behaviour is prose "shall I commit?" instead of a structured two-option prompt with diff preview
5. **Branch naming** — when issue type or scope allows multiple conventions (`issue-NNN-x` vs `feat/x` vs `fix/x`)
6. **Skill routing** — when the trigger keywords match 2+ skills (e.g., "analyze content" could be `ContentAnalysis` or `Research`)
7. **Effort-level clarification** — when OBSERVE's reverse-engineering can't decide between Standard and Extended
8. **Upstream triage** — ScanWorkflow already uses it; should be pattern-homogeneous with everything above
9. **Diataxis pack drift** — already uses it; same comment
10. **Subagent model selection** — haiku vs sonnet vs opus when the DA is unsure, rather than silently defaulting to parent model

Touchpoints 1, 2, 4, 5, 6, 7 are the net-new targets where the rule exists but firing is inconsistent.

## 6. Trade-offs Summary

| Sub-decision | Option | Cost | Delivered value |
|---|---|---|---|
| 4.1 Contract | Hybrid (c) | Small | Zero migration; keeps existing 14 sites intact; PAI contract only where breakage exists |
| 4.2 Trigger | Combined (c) | Small | Load-bearing gate in ALGORITHM; tightened rule in NATIVE |
| 4.3 Subagent | Bubble (b) | Small | Preserves hook invariants; batches multi-agent choices |
| 4.4 Fallback | Abstract contract (b) | Trivial | Spec exists for future adapters; forces cancel/multiselect/free-text decisions now |

Total implementation effort estimate: **0.5–1 engineering day** once a spec-out issue is opened. Net risk: low — no runtime behaviour changes for existing calls.

## 7. Recommendation

**Adopt the hybrid design.** Concretely:

1. **Keep** direct `AskUserQuestion` invocations in the 14 existing sites. Do not rename.
2. **Add** a new ENUMERATE→OFFER sub-step at OBSERVE exit in `PAI/Algorithm/LATEST`, specifying that every unresolved discrete multi-option decision must either be committed-with-rationale or surfaced via `AskUserQuestion`.
3. **Add** `❓ OPEN_CHOICES: [...]` field to the NATIVE output format in `PAI/CLAUDE.md`. Non-empty content must be paired with an `AskUserQuestion` invocation in the same turn.
4. **Tighten** `AISTEERINGRULES.md:64` with a concrete trigger list (the six net-new inventory items in §5) and a worked example.
5. **Publish** `PAI/PROTOCOLS/qa-contract.md` (new, short file) documenting the Request/Response schema in §4.4 and referencing it from both carriers in §4.3.
6. **Revise** `PAI/THEDELEGATIONSYSTEM.md` with a new subsection on the `pending_user_choices[]` bubble protocol, explicitly referencing the schema in (5).
7. **Partial probe already done** — `general-purpose` subagent confirmed `ASK_USER_QUESTION_STATUS: ABSENT`. One remaining probe item: specialised subagent types (Architect, Engineer, Plan, etc.) may differ; a single-line probe is worth running before implementation in case option §4.3(a) becomes partially viable for certain agent types.

Explicit non-goals: no wrapper skill, no rename of `AskUserQuestion`, no new tool, no non-CC adapter code, no changes to existing hooks, no edits to the 14 existing call sites.

## 8. Implementation Handoff

A follow-up issue should scope:

1. **Algorithm edit** — add ENUMERATE→OFFER step to `PAI/Algorithm/LATEST`. Must include: (a) the enumeration directive, (b) the commit-with-rationale escape clause, (c) the free-text / subjective-decision exclusion, (d) a worked example showing a commit-with-rationale and an AskUserQuestion path side by side. Realistic size: 300-500 words plus example block. (Corrected from initial 150-word estimate per critique.)
2. **NATIVE format edit** — add `❓ OPEN_CHOICES:` line to the NATIVE output format in `PAI/CLAUDE.md`. One-line format directive plus a one-paragraph explanation. Reference the same behavioural rule from `AISTEERINGRULES.md:64`.
3. **Steering rule edit** — rewrite `AISTEERINGRULES.md:64` with trigger list (6 net-new targets from §5) + worked example. One bullet replacement.
4. **New protocol doc** — create `PAI/PROTOCOLS/qa-contract.md`. Required sections: (i) Request schema (header, question, options, allow_free_text, allow_cancel, multi_select), (ii) Response schema (selected, free_text, cancelled), (iii) Carrier A: subagent return-value pattern with example, (iv) Carrier B: DA→user `AskUserQuestion` mapping, (v) Invariants (one asker; batching ≤4 questions; null allowed iff allow_cancel), (vi) Non-CC harness stub note. Realistic size: 150-250 lines of Markdown with examples.
5. **Delegation-system edit** — add "User-choice bubbling" subsection to `PAI/THEDELEGATIONSYSTEM.md` with cross-reference to the protocol doc. Include an anti-pattern example ("subagent asking directly" → bad).
6. **Remaining runtime probe** — launch Task subagents of type Architect, Engineer, Plan (one each) with the same tool-introspection prompt used in this investigation; record `AskUserQuestion` availability per type. Outcome determines whether §4.3(a) is viable for any specific subagent type. Estimated 5-10 minutes.
7. **Pack policy note** — add a one-line "pack must use the bubble protocol or call AskUserQuestion only if the pack runs in the primary DA context" rule somewhere discoverable (probably `PAI/SKILLSYSTEM.md`). This addresses the propagation risk that replaced row 14 of the coupling table. Define a done-state: any new pack added after this policy either (a) matches the pattern or (b) triggers a review.

Realistic effort estimate: **1 engineering day** for a single-author implementation PR (revised upward from initial 0.5 day estimate per critique). All seven items are prompt/doc edits plus the short probe — no runtime code changes.

## 9. Scope Boundary

This document is investigation output only. Per issue #143: "Implementation. This issue is investigation only; propose the design, then spin out an implementation issue." No code, prompt files, or hook files have been modified on branch `issue-143-askuserquestion-investigation`. The follow-up issue should reference this report's §8 as the work breakdown.

---

## Appendix A — Verification Caveats

- The claim "subagents cannot invoke `AskUserQuestion` today" is **verified for `subagent_type: "general-purpose"`** via a runtime probe launched during this investigation (result: `ASK_USER_QUESTION_STATUS: ABSENT`, `TOOL_SEARCH_VISIBLE: No`). The claim is **not yet verified** for specialised subagent types (Architect, Engineer, Plan, etc.) — §8 item 6 covers the remaining probes.
- The 13 verified coupling points (formerly 14 — row 14 removed per critique as a propagation risk, not a present-day coupling) are accurate as of 2026-04-21 across `$PAI_DIR` runtime + `virtualian/pai` repo `main` branch. Pack policy in §8 item 7 addresses future propagation.
- The CC `AskUserQuestion` tool schema was read from this session's deferred-tool loader; it matches the Request/Response contract in §4.4 exactly. The subagent bubble protocol in §4.3 uses the same schema (§4.4 Schema Unification note).
- The inventory of `MEMORY/LEARNING/FAILURES/2026-04/*` sessions (basis for "triggering drift" claim in §4.2) was identified via a `grep` over failure transcripts that matched patterns consistent with user-expected-a-question scenarios. Individual transcripts were not manually classified — the claim "triggering is inconsistent" is supported by the existence of these failure records, not by a quantitative audit of each one.

## Appendix B — Related Work Already Present in PAI

- `AISTEERINGRULES.md:64` — existing behavioural rule (will be tightened, not replaced)
- `AISTEERINGRULES.md:34` — existing destructive-action rule (already aligned with §5 inventory #3)
- `hooks/SetQuestionTab.hook.ts` + `hooks/QuestionAnswered.hook.ts` — existing cosmetic integration (unchanged)
- `PAI/Tools/ScanWorkflow.md:132` — canonical example of the pattern (unchanged; becomes the reference implementation callers should mirror)
- `PAI/Tools/TranscriptParser.ts:319` — existing runtime inspection of `tool_use.name === 'AskUserQuestion'` (unchanged)
