# PAI Prompt Audit — Claude Opus 4.7 Compatibility

**Date:** 2026-04-17
**Auditor:** Claude Opus 4.7 (1M context), PAI Algorithm 3.7.0
**Scope:** PAI runtime (`/Users/ianmarr/.pai/`), Claude Code config (`/Users/ianmarr/.claude/`), shipped repo (`/Users/ianmarr/projects/pai/Releases/v4.0.3+/`).
**Method:** Primary-source retrieval of Anthropic's 4.7 documentation + line-by-line audit of PAI prompt files + structural analysis of rule interactions.

---

## 1. Executive Summary

Anthropic's own Opus 4.7 documentation characterises the model as "substantially better at following instructions" and enumerates specific behavioural changes: **more literal instruction reading, strict effort-level calibration, fewer tool calls by default, fewer subagents by default, more direct tone with fewer emoji, and a preference for positive over negative framing**. Every claim in this report's Anthropic section is sourced to `anthropic.com` or `platform.claude.com` (see Section 5).

Applied against PAI's current prompts, this audit found **four Critical findings** (one shipped-release bug, three direct collisions with Anthropic's stated 4.7 behaviour), **eight High findings** (contradictions or ordering ambiguities a literal reader will trip on), and a longer tail of Medium and Low.

**Top five findings, ranked:**

| # | Finding | Severity | Impact scope |
|---|---|---|---|
| 1 | `loadAtStartup` references two files that do not exist in either runtime or shipped release (`PAI/USER/AISTEERINGRULES.md`, `PAI/USER/PROJECTS/PROJECTS.md`) | Critical | Shipped — every installer user |
| 2 | Algorithm 3.7.0 line 27: *"When in doubt, invoke MORE capabilities not fewer"* directly opposes Anthropic's documented 4.7 default: *"Fewer tool calls by default; raise effort or prompt explicitly."* | Critical | Shipped |
| 3 | Format inventory disagreement between `~/.claude/CLAUDE.md:50` (three formats: ALGORITHM/NATIVE/MINIMAL) and `Algorithm/v3.7.0:7` (four formats: adds ITERATION); a literal-reading model cannot satisfy both | Critical | Shipped (both files ship) |
| 4 | "Euphoric Surprise — 9-10 ratings" goal (4 occurrences in Algorithm + SKILL.md) collides with Anthropic's documented 4.7 shift toward "more direct tone, fewer emoji, less validation-forward phrasing" | Critical | Shipped |
| 5 | Imperative-verb inflation: 26 "CRITICAL / NEVER / MUST / hard block / dishonest" markers in Algorithm/v3.7.0 alone; Anthropic's prompt guide now explicitly recommends replacing negatives with motivated positives | High | Shipped |

The overall pattern is not that Opus 4.7 will break PAI, but that several PAI idioms (emotive goals, density of absolutes, "invoke more not fewer", inferred intent) were *already* in tension with Anthropic's published prompt-engineering guidance and 4.7 has now made the guidance load-bearing instead of advisory.

---

## 2. Anthropic Opus 4.7 — What Was Actually Published

### 2.1 Canonical behaviour reference (Verified)

Anthropic now publishes **one** consolidated prompt guide — "Prompting best practices" — stated to cover Opus 4.7, Opus 4.6, Sonnet 4.6 and Haiku 4.5. The older `docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/*` sub-pages (Be clear direct and detailed, Use examples, System prompts, Prefill, Chain of thought, XML tags, Long context) have been collapsed into this single page and 301-redirect to it.

- Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- What's new in Opus 4.7: https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7
- Migration guide: https://platform.claude.com/docs/en/about-claude/models/migration-guide
- Launch announcement: https://www.anthropic.com/news/claude-opus-4-7

No Opus 4.7 System Card PDF is listed on `anthropic.com/system-cards` as of 2026-04-17. (Unverified whether one exists internally.)

### 2.2 Strictness claims — verbatim from Anthropic primary sources

| Source | Verbatim quote |
|---|---|
| *What's new — Behavior changes* | *"More literal instruction following, particularly at lower effort levels. The model will not silently generalize an instruction from one item to another, and will not infer requests you didn't make."* |
| *Prompting best practices — More literal instruction following* | *"Claude Opus 4.7 interprets prompts more literally and explicitly than Claude Opus 4.6… If you need Claude to apply an instruction broadly, state the scope explicitly (for example, 'Apply this formatting to every section, not just the first one')."* |
| *Migration guide — Behavior changes #6* | *"Stricter effort calibration: Meaningfully changing from Claude Opus 4.6, Claude Opus 4.7 respects effort levels strictly, especially at the low end. At `low` and `medium`, the model scopes its work to what was asked rather than going above and beyond."* |
| *Migration guide — Behavior changes #3* | *"More direct tone, fewer emoji, less validation-forward phrasing."* |
| *Migration guide — Behavior changes #5* | *"Fewer subagents spawned by default; steer explicitly."* |
| *Migration guide — Behavior changes #7* | *"Fewer tool calls by default; raise effort or prompt explicitly."* |
| *Prompting best practices — Be clear and direct* | *"Positive examples showing how Claude can communicate… tend to be more effective than negative examples or instructions that tell the model what not to do."* (canonical replacement: `NEVER use ellipses` → `Your response will be read aloud by a text-to-speech engine, so never use ellipses…`) |
| *Prompting best practices — Code review harnesses* | *"When a review prompt says… 'be conservative,' or 'don't nitpick,' Claude Opus 4.7 may follow that instruction more faithfully than earlier models did."* |

### 2.3 Still-in-force prompt-engineering guidance (Verified)

Positive framing > negative; motivate instructions with reasons ("Claude is smart enough to generalise from the explanation"); use 3–5 XML-wrapped examples; use `<instructions>` / `<context>` / `<input>` tags; in long-context prompts put data at top and query at end. **Prefill is removed on 4.7** — assistant-message prefill returns 400.

### 2.4 Gaps — what Anthropic has NOT published (Unverified)

- No Opus 4.7 System Card PDF indexed as of 2026-04-17.
- No dedicated "prompt migration from 4.6" page — prompt-behaviour migration folded into *Prompting best practices → Prompting Claude Opus 4.7*.
- No Anthropic-authored "known prompt regressions" list. Third-party bug reports exist on `github.com/anthropics/claude-code/issues` but are not Anthropic-endorsed.

---

## 3. Findings against PAI

Every file:line citation below was verified against the runtime copy at audit time. Line numbers may shift as files are edited.

### 3.1 Critical

**C-1. `loadAtStartup` references two non-existent files (shipped).**
`~/.claude/settings.json:272-274` and shipped `Releases/v4.0.3+/.claude/settings.json` both force-load:

```
PAI/AISTEERINGRULES.md          ✅ exists
PAI/USER/AISTEERINGRULES.md     ❌ missing
PAI/USER/PROJECTS/PROJECTS.md   ❌ missing
```

Verified via `ls /Users/ianmarr/.pai/PAI/USER/` — directory exists, the two files do not. `LoadContext.hook.ts` either silently skips or errors. A more-literal 4.7 will either propagate the error visibly or treat the broken reference as a real instruction to load something that doesn't exist. Shipped bug — affects every new installer run.

**C-2. PAI's capability-selection rule is inverted relative to Anthropic's 4.7 default.**
`Algorithm/v3.7.0.md:27` ends: *"When in doubt, invoke MORE capabilities not fewer."* Anthropic's migration guide explicitly documents 4.7 as *"Fewer tool calls by default… Fewer subagents spawned by default; steer explicitly."* These are opposite directional nudges. The Algorithm also tier-floors capability counts (min 4 at Advanced, 6 at Deep, 8 at Comprehensive — `Algorithm/v3.7.0.md:21-25`) which will force invocations 4.7 is otherwise designed to suppress.

**C-3. Format inventory contradiction between CLAUDE.md and the Algorithm.**
- `~/.claude/CLAUDE.md:50`: *"Every response MUST use exactly one of the output formats above (ALGORITHM, NATIVE, or MINIMAL). No freeform output."* — **three** formats.
- `Algorithm/v3.7.0.md:7`: *"…exactly one of the output formats defined in the Execution Modes section of CLAUDE.md (ALGORITHM, NATIVE, ITERATION, or MINIMAL)."* — **four** formats.

CLAUDE.md body shows only the NATIVE block template (lines 33-42); ALGORITHM, ITERATION and MINIMAL are named but never defined in either file. A literal 4.7 reader presented with "use a format defined in CLAUDE.md" will find only NATIVE defined, and will find ITERATION named in one file but excluded from the other's whitelist.

**C-4. "Euphoric Surprise" goal vs Anthropic's documented 4.7 tone shift.**
`Algorithm/v3.7.0.md:3`: *"Goal: **Euphoric Surprise** — 9-10 ratings."* Repeated at lines 70, 403, 430; mirrored in `SKILL.md:41, 70, 403, 430`. `CLAUDE-USER.md:3` separately mandates *"Direct, dry, low-affect. No cheerleading."* Anthropic's migration guide #3: *"More direct tone, fewer emoji, less validation-forward phrasing."* The Euphoric Surprise framing is precisely the validation-forward register 4.7 has been tuned away from, and the user's own tone preferences (low-affect) already conflict with it. Under 4.7 this will surface either as the model picking one and ignoring the other, or as visible tonal wobble between responses.

### 3.2 High

**H-1. Imperative-verb inflation.**
`Algorithm/v3.7.0.md` contains 26 instances of NEVER / no exceptions / MUST NOT / hard block / CRITICAL FAILURE / dishonest / forbidden (counted by the audit agent, spot-checked). `AISTEERINGRULES.md` density: ~19 absolute markers in 96 lines (~20%). Anthropic's prompt guide now explicitly recommends replacing negatives with motivated positives — the canonical example is `NEVER use ellipses` → `Your response will be read aloud by a text-to-speech engine, so never use ellipses…`. PAI's negatives generally do not carry that motivation clause.

**H-2. Negative-framing density clashes with Anthropic's recommended positive framing.**
Beyond raw counts, most PAI absolutes are unmotivated ("No exceptions", "CRITICAL FAILURE", "dishonest", "hard block"). The Anthropic guidance isn't that negatives are forbidden — it's that they should carry reasoning so the model can generalise. PAI's pattern is assertion without reasoning, which a literal reader treats as a flat refusal rather than a guardrail with an escape clause.

**H-3. "FIRST THING" vs "FIRST ACTION" ordering ambiguity across all seven phases.**
`Algorithm/v3.7.0.md:148`: *"Output the phase header line as the FIRST thing at each phase, before the PRD edit."* Lines 152, 335, 348, 373, 394, 401, 428 each declare: *"**FIRST ACTION:** Edit PRD frontmatter…"*. Both mandates claim primacy; a literal reader cannot collapse them without picking a winner.

**H-4. "ALL WORK INSIDE THE ALGORITHM" contradicts the FAST-PATH classifier.**
`Algorithm/v3.7.0.md:111`: *"Once ALGORITHM mode is selected, every tool call, investigation, and decision happens within Algorithm phases."* `Algorithm/v3.7.0.md:196-199`: the FAST-PATH rows permit skipping OBSERVE/THINK/PLAN/BUILD/LEARN for atomic, mechanical and extraction cases. Under literal reading, "every decision… within Algorithm phases" and "skip phases entirely" are in direct conflict.

**H-5. Stale path references (`~/.claude/PAI/…`).**
- `Algorithm/v3.7.0.md:463`: *"Full spec: `~/.claude/PAI/PRDFORMAT.md`"* — `/Users/ianmarr/.claude/PAI/` does not exist. Correct path: `~/.pai/PAI/PRDFORMAT.md`. Verified via `ls`.
- `PRDFORMAT.md:143`: same broken path repeated.
- `SKILL.md:445` and `SKILLSYSTEM.md:227`: reference `~/.claude/skills/Science/Protocol.md` — file does not exist. Verified via `ls`.
- `SKILL.md:409` and `SKILLSYSTEM.md:832`: reference `~/.claude/PAI/THENOTIFICATIONSYSTEM.md` — neither `~/.claude/PAI/THENOTIFICATIONSYSTEM.md` *nor* `~/.pai/PAI/THENOTIFICATIONSYSTEM.md` exists (agent B's partial claim about the alternate location turns out to also be wrong — the file is gone).

**H-6. Atomic-scope lock vs capability-selection mandate.**
`AISTEERINGRULES.md:54`: *"When the user issues an atomic narrow request… the ONLY acceptable response is that exact action plus verification… Any expansion, related work, capability selection… triggers a mandatory stop-and-confirm."* `Algorithm/v3.7.0.md:27`: *"Listing a capability but never calling it via tool is a **CRITICAL FAILURE**."* A request classified as atomic cannot both respect scope-lock and satisfy the capability-invocation floor. The Algorithm's FAST-PATH attempts to thread this, but the steering rule is scoped to fire *before* mode classification — leaving the ordering ambiguous in exactly the cases that matter.

**H-7. Banner assumption violated in Algorithm's first action.**
`Algorithm/v3.7.0.md:113`: *"Entry banner was already printed by CLAUDE.md before this file was loaded. The user has already seen: ♻︎ Entering the PAI ALGORITHM… (v3.7.0)"*. `~/.claude/CLAUDE.md` contains no banner text or banner-printing instruction. The banner gets printed only when the model volunteers it in response to CLAUDE.md:48's "MANDATORY FIRST ACTION". A literal 4.7 that does not infer the unstated step will skip the banner entirely, or print something other than the specified text.

**H-8. CLAUDE.md:48 sentence-boundary typo.**
*"…until the Algorithm completes.Critical Rules (Zero Exceptions)"* — missing newline between the paragraph and the header. Minor, but a stricter tokenizer may parse the concatenated sentence as a single unit and lose the header's semantic weight.

### 3.3 Medium

**M-1. 8-word mandates force oversimplification.**
`Algorithm/v3.7.0.md:190, :277` and `PRDFORMAT.md:31` constrain task descriptions, effort reasoning, and capability rationales to 8 words; ISC criteria to 8-12 words. Anthropic's #1 behavior change for 4.7 is *"Response length varies by perceived task complexity — remove fixed-verbosity scaffolding, re-baseline"*. Fixed word counts are exactly the fixed-verbosity scaffolding flagged.

**M-2. FAST-PATH and SCOPE GATE precedence is undefined.**
FAST-PATH is declared "Standard tier only" at `Algorithm/v3.7.0.md:192`; SCOPE GATE at `:166-174` has no tier guard. A Standard-tier atomic request matches both — the rules do not specify which gate wins. Under a more literal model this surfaces as nondeterminism.

**M-3. Unverifiable qualities in the rule set.**
"Euphoric Surprise" (Algorithm:3), "no flattery" / "low-affect" (CLAUDE-USER.md:3), "intellectual honesty" (CLAUDE-USER.md:6), "high agency" (CLAUDE-USER.md:9) — the model cannot self-verify any of these. They function as aspirational framing rather than testable rules. Opus 4.7's "will not infer" posture makes aspirational framing less effective than before.

**M-4. Response-format-first vs AskUserQuestion-at-end.**
`Algorithm/v3.7.0.md:7-8`: response MUST use a declared format, then "complete the current response format output FIRST, then invoke AskUserQuestion at the end". The resolution exists but is buried in a paragraph-long sentence at :8. A more literal reader weighting the bold-flagged :7 rule may produce format-locked output with no question, missing :8's "then ask" clause.

**M-5. Skill trigger ambiguity from intent-based matching.**
`SKILLSYSTEM.md:571` explicitly rejects phrase-matching in favour of intent matching. For the prior model generation this was the right call; 4.7's "will not infer" posture makes intent-matching harder to disambiguate across overlapping skills (`Research` / `Investigation` / `Security` all plausibly match "research this company").

**M-6. "just" semantics disagreement.**
`SKILL.md:33`: *"The word 'just' does not reduce depth."* `AISTEERINGRULES.md:54` lists "just create the branch" / "I just want Y" as triggers that *do* reduce scope. Two rules assign opposite weights to the same lexical cue.

**M-7. Time-budget auto-compress vs ALL-WORK-INSIDE rule.**
`Algorithm/v3.7.0.md:31`: *"TIME CHECK at every phase — if elapsed >150% of budget, auto-compress."* `:111`: *"every tool call, investigation, and decision happens within Algorithm phases. No work outside the phase structure."* Auto-compress may require exiting phases early; no precedence given.

### 3.4 Low

**L-1.** `MEMORY.md` index entries in `/Users/ianmarr/.claude/projects/…/memory/MEMORY.md` format as `- [Title](file.md) — hook` but some entries use a `[file.md](...)` style (e.g. `[feedback_git_ssh.md]`) — cosmetic inconsistency only.

**L-2.** Phantom-capability rule at `Algorithm/v3.7.0.md:235` permits mid-flight removal ("remove it from the selected list with a reason"); the same rule elsewhere (:10, :27) labels non-invocation "CRITICAL FAILURE" without naming the removal escape hatch. A literal reader finding :10 first may treat removal as still-failing.

**L-3.** Voice-notification mandates in skill workflows (`SKILL.md`, FirstPrinciples skill) require `curl http://localhost:8888/notify` — non-fatal if the service is down, but a stricter 4.7 may surface the failure rather than silently succeed.

**L-4.** Use of CRITICAL / MANDATORY / 🚨 for naming/structural rules (SKILLSYSTEM.md category) at the same intensity as algorithmic rules collapses their priority signal.

---

## 4. Impact distribution: shipped release vs Ian-only runtime

| Finding | Shipped (every installer) | Ian-only runtime |
|---|---|---|
| C-1 missing loadAtStartup files | Yes — `Releases/v4.0.3+/.claude/settings.json` references them | Same |
| C-2 "invoke MORE capabilities" | Yes — in `Algorithm/v3.7.0.md` | Same |
| C-3 format inventory mismatch | Yes — both files ship | Same |
| C-4 Euphoric Surprise vs tone | Shipped: Algorithm carries Euphoric Surprise. Tone conflict is Ian-specific (his CLAUDE-USER.md) | Ian amplifies the conflict |
| H-1, H-2 imperative inflation | Shipped | — |
| H-3 FIRST THING / FIRST ACTION | Shipped | — |
| H-4 ALL WORK vs FAST-PATH | Shipped | — |
| H-5 stale paths | Shipped (path strings are in shipped Algorithm + PRDFORMAT + SKILL + SKILLSYSTEM) | — |
| H-6 atomic-scope vs capability | Shipped | — |
| H-7 banner assumption | Shipped | — |
| H-8 CLAUDE.md typo | Shipped if installer copies verbatim; Ian-specific otherwise | Confirmed in Ian's runtime |
| M-1..M-7 | Mostly shipped | — |

Most findings are shipped-surface issues, not Ian-local quirks.

---

## 5. Remediation suggestions (non-prescriptive — user decides)

Ordered by effort:payoff ratio, not importance. These are suggestions, not a plan.

**Low-effort, high-payoff:**

1. **Fix C-1** by either (a) removing the two missing filenames from `loadAtStartup` in both `~/.claude/settings.json` and `Releases/v4.0.3+/.claude/settings.json`, or (b) creating placeholder files with a `# Intentionally empty` body. Either works; the first is tidier.
2. **Fix C-3** by reconciling the format inventories. Pick three or four, then make one file reference the other authoritatively instead of restating the list. Deletion over duplication.
3. **Fix H-5** by search-and-replace: every `~/.claude/PAI/` → `${PAI_DIR}/PAI/` (or equivalent) in `Algorithm/v3.7.0.md:463`, `PRDFORMAT.md:143`, and anywhere else grep finds. Confirm missing files are actually missing and either recreate or remove the reference (e.g. `THENOTIFICATIONSYSTEM.md`).
4. **Fix H-8** with a one-character edit.

**Medium-effort, load-bearing:**

5. **C-2 and M-1 are policy calls, not bugs.** If "invoke MORE capabilities not fewer" is genuinely what PAI wants under 4.7, say so explicitly and override Anthropic's default. If it isn't, invert the default ("invoke only capabilities you'll actually use"). Same for fixed-word-count mandates: either keep them with a documented rationale or retire them in favour of "as short as the content allows".
6. **H-1, H-2: pass each negative rule through the Anthropic motivation rewrite.** `NEVER do X` → `Because Y, don't do X`. Anthropic's own example pattern is the template.
7. **H-3: pick one ordering for phase entry** — either "print the header, then edit the PRD" or vice versa — and strike the duplicate directive. Either is defensible; ambiguity is not.
8. **H-4: reconcile FAST-PATH with ALL-WORK-INSIDE.** Either FAST-PATH is a formal Algorithm subset (so phase-skipping is within-phase) or the ALL-WORK-INSIDE rule needs a "except FAST-PATH" clause.

**High-effort, strategic:**

9. **C-4 is a design choice.** "Euphoric Surprise" as a framing device predates 4.7. Anthropic's new tone defaults don't forbid it, but they do make it work against the grain. Consider whether the goal is still served by the framing or only by the underlying ISC/verification mechanism.
10. **Imperative-verb inflation (H-1) merits a system-wide pass.** Reserve CRITICAL / MANDATORY for the two or three rules whose violation genuinely derails sessions. Everything else gets a milder verb or a motivated explanation.

---

## 6. Sources

Primary (Anthropic-owned):

- Opus 4.7 launch announcement — https://www.anthropic.com/news/claude-opus-4-7
- What's new in Claude Opus 4.7 — https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7
- Migration guide (4.6 → 4.7) — https://platform.claude.com/docs/en/about-claude/models/migration-guide
- Prompting best practices (single consolidated guide) — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Prompt engineering overview (redirects to the above) — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
- System cards index (no 4.7 PDF listed as of 2026-04-17) — https://www.anthropic.com/system-cards

Secondary (Anthropic-owned, Claude Code specific):

- Best practices for using Claude Opus 4.7 with Claude Code — https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code

PAI source files cited (all local, verified at audit time):

- `/Users/ianmarr/.claude/CLAUDE.md`
- `/Users/ianmarr/.claude/CLAUDE-USER.md`
- `/Users/ianmarr/.claude/settings.json`
- `/Users/ianmarr/.pai/PAI/Algorithm/v3.7.0.md`
- `/Users/ianmarr/.pai/PAI/AISTEERINGRULES.md`
- `/Users/ianmarr/.pai/PAI/CONTEXT_ROUTING.md`
- `/Users/ianmarr/.pai/PAI/PRDFORMAT.md`
- `/Users/ianmarr/.pai/PAI/SKILL.md`
- `/Users/ianmarr/.pai/PAI/SKILLSYSTEM.md`
- `/Users/ianmarr/projects/pai/Releases/v4.0.3+/.claude/settings.json`

---

**Report end.**
