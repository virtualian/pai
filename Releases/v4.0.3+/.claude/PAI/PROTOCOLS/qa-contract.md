# Q&A Contract — PAI User-Choice Protocol

**Status:** Normative. This document is the single source of truth for the structured-choice contract used by PAI's Algorithm ENUMERATE→OFFER gate, the NATIVE `❓ OPEN_CHOICES:` field, and the subagent bubble protocol.

**Introduced by:** issue #148 (design report `reports/20260421-issue-143-askuserquestion-pai-design.md` §4.4).
**Implements:** the abstract shape described in that report, with one schema reused across two carriers.

---

## 1. Overview

PAI exposes user-choice as a *contract*, not a tool. The contract has one Request/Response schema (defined below) and two Carriers that move messages between the three actors:

- **Subagent** (spawned via `Task`/`Agent`) — emits `pending_user_choices[]` in its return value when it hits a multi-option decision.
- **Primary DA** — aggregates pending choices from all running subagents, filters duplicates, batches, and issues the prompt.
- **User** — receives a structured prompt (via `AskUserQuestion` in Claude Code, or the abstract contract in a future non-CC harness) and replies.

The contract applies to **discrete, enumerable** multi-option decisions (2–4 options, mutually exclusive, expressible as short labels). It does NOT apply to free-text input, subjective/stylistic decisions, or open-ended solicitation — those remain outside the structured-choice layer.

---

## 2. Request schema

A Request represents a *single* choice. A Carrier may batch multiple Requests.

```
Request {
  header:            string    // tab/chip label shown to user, ≤12 chars
  question:          string    // full question text, ends with "?"
  options:           Option[]  // 2..4 entries
  allow_free_text:   boolean   // "Other" escape hatch, default: true
  allow_cancel:      boolean   // user may explicitly decline, default: false
  multi_select:      boolean   // allow >1 option selected, default: false
}

Option {
  label:        string   // display text, 1-5 words
  description:  string   // consequence/context for this choice
  preview?:     string   // optional multi-line visual comparison (single-select only)
}
```

**Field rules:**
- `header` is truncated hard at 12 chars by the CC harness — keep it short.
- `question` must be a complete sentence ending in `?`.
- `options.length` MUST be 2, 3, or 4.
- `options[].label` values must be mutually distinct within the same Request.
- `preview` is single-select only — ignored when `multi_select = true`.

---

## 3. Response schema

```
Response {
  selected:    string | string[] | null   // label(s) chosen; null iff cancelled
  free_text:   string | null              // populated when "Other" was selected
  cancelled:   boolean                    // true iff user explicitly cancelled
}
```

**Invariants tied to the Request:**
- `cancelled = true` is valid ONLY if the Request set `allow_cancel = true`.
- `free_text` is non-null ONLY if the Request set `allow_free_text = true`.
- If `multi_select = true`, `selected` is `string[]`; otherwise it is `string`.
- When `cancelled = true`, `selected` is `null` and `free_text` is `null`.

---

## 4. Carrier A — Subagent return-value

When a subagent hits a user-choice point it MUST NOT invoke `AskUserQuestion`. It returns a structured `pending_user_choices` field alongside whatever partial result it has produced, and pauses.

**Return shape:**

```json
{
  "partial_result": "...",
  "pending_user_choices": [
    {
      "header": "Cache impl",
      "question": "Which cache backend should the subagent use?",
      "options": [
        { "label": "Redis",   "description": "Mature, on-prem friendly, requires a separate service." },
        { "label": "Upstash", "description": "Serverless HTTP API, no infra, usage-priced." }
      ],
      "allow_free_text": true,
      "allow_cancel": false,
      "multi_select": false
    }
  ],
  "status": "paused_awaiting_choices"
}
```

The subagent may emit 0..N entries in `pending_user_choices[]`. Each entry is a fully-formed Request (§2). The DA is responsible for:
- Deduping identical requests emitted by parallel subagents.
- Enforcing the ≤4 batch size (§6) — splitting into multiple DA→user rounds if more accumulate.
- Re-injecting the Response back into the paused subagent via `SendMessage` or an equivalent resume mechanism.

**Empty-batch rule.** If a subagent has no user-choice points to surface, it returns normally — it MUST NOT emit `pending_user_choices: []` alongside a completed result. The field's presence is the signal for `status: paused_awaiting_choices`; an empty array is a protocol violation. Equivalently: omit the field when there is nothing to ask.

---

## 5. Carrier B — DA → User (`AskUserQuestion` mapping)

The DA renders batched Requests as a single `AskUserQuestion` call. Request fields map to the CC tool fields one-to-one:

| PAI contract field | CC `AskUserQuestion` field           | Notes |
|--------------------|---------------------------------------|-------|
| `header`           | `questions[].header`                  | Direct |
| `question`         | `questions[].question`                | Direct |
| `options`          | `questions[].options`                 | Direct (`label` + `description` + optional `preview`) |
| `multi_select`     | `questions[].multiSelect`             | Direct |
| `allow_free_text`  | (implicit — always true in CC)        | CC auto-renders an "Other" escape; field is advisory for non-CC adapters |
| `allow_cancel`     | (not supported in CC)                 | CC has no first-class cancel; adapters SHOULD surface a cancel option manually via `options` if needed |

**Example — DA batching two pending choices into one call:**

```typescript
// Pending from Subagent-A: branch naming
// Pending from Subagent-B: commit bundling
AskUserQuestion({
  questions: [
    {
      header: "Branch",
      question: "Which branch-naming convention for #148?",
      options: [
        { label: "148-kebab",       description: "Matches repo Version Control Standard." },
        { label: "feat/148-kebab",  description: "Common OSS convention; does not match local standard." }
      ],
      multiSelect: false
    },
    {
      header: "PR split",
      question: "Bundle the seven work items into one PR, or split?",
      options: [
        { label: "One PR",  description: "Atomic — Algorithm + NATIVE + rules + protocol + delegation + policy." },
        { label: "Split",   description: "Per work item; more PRs to review." }
      ],
      multiSelect: false
    }
  ]
})
```

**CC → Carrier A Response mapping.** The CC harness returns a single `answers` object keyed by the exact `question` string of each original Request. The DA converts each entry into a Carrier A `Response` for the originating subagent as follows:

| CC `answers` value | Resulting Response `selected` | `free_text` | `cancelled` |
|---|---|---|---|
| A label string matching one of `options[].label` | that label | `null` | `false` |
| A string that does NOT match any `options[].label` (user typed into "Other") | `null` | that string | `false` |
| Missing key for a question (user closed the prompt without answering) | `null` | `null` | `true` — only valid if `allow_cancel = true`, else protocol violation |
| For `multi_select = true`, CC returns a comma- or array-delimited value | `string[]` of matched labels; unmatched entries spill into `free_text` (nullable) | as above | `false` |

The DA then resumes each paused subagent with the constructed Response via `SendMessage` (or equivalent), mapped one-to-one with the originating `pending_user_choices[]` entry.

---

## 6. Invariants

1. **One asker.** Only the primary DA invokes `AskUserQuestion`. Subagents never do. This preserves the one-tab, one-asker model the existing `SetQuestionTab` + `QuestionAnswered` hooks assume.
2. **Batch ≤4.** A single `AskUserQuestion` call carries 1..4 Requests. If more accumulate, the DA performs serial rounds — each round ≤4.
3. **`null` iff `allow_cancel`.** A Response with `cancelled = true` is valid only for Requests that opted in. Otherwise `cancelled = true` is a protocol violation and the DA must retry or surface an error.
4. **No free-text escape without opt-in.** `free_text` is populated only when the Request set `allow_free_text = true`. In CC this is always true; in non-CC adapters it is the adapter's obligation to enforce.
5. **Schema is source-of-truth.** Callers — Algorithm prose, `AISTEERINGRULES.md`, `THEDELEGATIONSYSTEM.md`, pack code — reference this document. They MUST NOT re-specify the Request/Response shape inline; divergence between inline copies and this spec is the most likely drift vector.
6. **Discrete-choice only.** Free-text and subjective decisions MUST NOT be wrapped as Requests — route them through normal response prose instead.
7. **Free-text and cancel are independent.** `allow_free_text` and `allow_cancel` may both be `true` on the same Request. If the user both types into "Other" and then cancels, `cancelled = true` wins: the Response is `{selected: null, free_text: null, cancelled: true}`. A non-null `free_text` is therefore only present when the user committed to an "Other" answer, not when they abandoned it.
8. **Dedupe identity.** Two Requests are "identical" for dedupe purposes (§4) iff they are deep-equal on the tuple `(header, question, sorted(options[].label))`. Differences in `description`, `preview`, `allow_*`, or `multi_select` do NOT break dedupe — the DA uses the widest permission set of the deduped inputs. This is the definition adapters MUST implement; looser dedupe leaks duplicate prompts to the user.
9. **Label canonicalization for reverse-mapping.** When the CC `answers` value is compared against `options[].label` (§5 mapping table), both sides MUST be Unicode-NFC-normalised and whitespace-trimmed before comparison. This prevents a valid selection from being silently mis-classified as free-text because of an emoji variant, a trailing space, or an NFD/NFC mismatch.

---

## 7. Non-CC harness stub note

No non-CC PAI surface exists today. This document defines the abstract contract so any future adapter — CLI stdin/stdout, a chat bot, an API — has a fixed target. An adapter must:

1. Accept a `Request[]` batch (§2).
2. Render it in whatever modality the harness supports (terminal menu, inline UI, API response).
3. Return a `Response` per Request (§3), preserving the invariants (§6).

The CC backend is a trivial pass-through: `AskUserQuestion` already accepts the same Request shape and returns answers keyed by question text (Carrier B, §5). A future adapter's correctness is measured by round-tripping through this contract without data loss.

---

## 8. Related

- `PAI/Algorithm/v3.7.0.md` — ENUMERATE→OFFER sub-step invokes this contract via Carrier B for DA-level choices.
- `.claude/CLAUDE.md` (and `.claude/CLAUDE.md.template`) — NATIVE `❓ OPEN_CHOICES:` field is this contract's surface in NATIVE mode.
- `PAI/AISTEERINGRULES.md` — "AskUserQuestion for choices" rule is the behavioural trigger list for this contract.
- `PAI/THEDELEGATIONSYSTEM.md` "User-choice bubbling" — operational guide for Carrier A.
- `PAI/SKILLSYSTEM.md` — pack user-choice policy refers packs to this contract.
- `reports/20260421-issue-143-askuserquestion-pai-design.md` §4.4 — design rationale for the Request/Response shape.
- `hooks/SetQuestionTab.hook.ts`, `hooks/QuestionAnswered.hook.ts` — cosmetic integration that assumes the one-asker invariant (§6.1).
