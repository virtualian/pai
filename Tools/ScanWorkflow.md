# Upstream Scan Workflow

Scan the upstream PAI repository for new issues, PRs, and discussions. Cross-reference against our local system to identify what's relevant. Uses incremental digest tracking with disposition-based action tracking to avoid re-reading already-processed content while ensuring pending items aren't silently lost.

Adapted from jlacour-git's solution (danielmiessler/Personal_AI_Infrastructure#923).

## Step 0 — Run the UpstreamScan Tool (MANDATORY FIRST STEP)

Before doing any manual work, run the CLI tool that automates the mechanical scan:

```bash
bun Tools/UpstreamScan.ts --author YOUR_GITHUB_USERNAME
```

Or set the `PAI_GITHUB_USER` environment variable to avoid passing `--author` each time.

This handles steps 1-4 automatically: loads the digest, fetches all GitHub data (issues, PRs, discussions, our PRs), applies disposition-based filtering, updates watermarks, and outputs a structured JSON report to stdout (progress on stderr).

**After the tool runs, skip to Step 5** (deep-dive relevant items) using the tool's output as input. The tool's `relevanceGuess` field is a heuristic first-pass — refine it with LLM judgment before presenting to the user.

**Flags:**
- `--no-gh` — Skip GitHub API calls, report digest state only (useful for offline review)
- `--digest <path>` — Custom digest path (default: `~/.claude/UPSTREAM-DIGEST.json`)
- `--patches <path>` — Custom LOCAL_PATCHES.md path (default: `~/.claude/LOCAL_PATCHES.md`)
- `--author <username>` — GitHub username for participation detection
- `--keywords-file <path>` — Custom relevance keywords JSON file

## Digest Schema (v2.0)

Each item in `UPSTREAM-DIGEST.json` has two independent dimensions:

1. **Data freshness** (`lastSeenAt`, `lastCommentCount`) — tracks what GitHub data we've fetched
2. **Disposition** — tracks what the user decided about this item

### Disposition Values

| Value | Meaning | Next scan behavior |
|-------|---------|-------------------|
| `new` | First seen in latest scan, not yet presented to user | **Re-surface** in report |
| `open` | Presented in scan report, awaiting user's decision | **Re-surface** in report |
| `ignore` | Explicitly decided: not relevant or not worth acting on | **Skip** unless new comments appear |
| `implemented` | Acted on — `action` field describes what was done | **Skip** unless new comments appear |
| `deferred` | Relevant but not acting now | **Skip** unless new comments appear |

### Disposition Lifecycle

```
(first seen) → new → open (after scan report presented to user)
                        ↓
              ┌─────────┼─────────┐
              ↓         ↓         ↓
           ignore   implemented  deferred
              ↑         ↑         ↑
              └─────────┴─────────┘
              (new comments trigger re-evaluation → back to open)
```

### Filtering Rules

| Condition | Action |
|-----------|--------|
| `disposition` is `new` or `open` | **Always re-surface** — decision pending |
| `disposition` is `ignore`/`implemented`/`deferred` AND `comments > lastCommentCount` | **Re-surface** — new activity on decided item |
| `disposition` is `ignore`/`implemented`/`deferred` AND `comments == lastCommentCount` | **Skip** — nothing new |
| Item NOT in digest | **New item** — add with `disposition: "new"` |

## Steps

### 1-4. Automated by UpstreamScan.ts

See Step 0 above. The tool handles digest loading, GitHub API calls, filtering, and watermark updates.

### 5. Deep-Dive Relevant Items

**Comment fetch rule:** Fetch comments on ALL new/reactivated items with `comments > 0`, EXCEPT items clearly not relevant (Linux-only, Windows-only, Docker-only). Pay special attention to items where `weParticipated: true`.

For each AFFECTS US or ALREADY HANDLED item:
- If it's an issue WITH a PR: read the PR diff (`gh pr diff N`), evaluate quality
- If it's an issue WITHOUT a PR: assess difficulty, consider if we should fix and PR it
- If it's a PR: review the code
- If it has overlap with our patches: compare approaches, note if theirs is better

### 6. Check Our PR Status

For each of our open PRs, check:
- Any new comments or reviews?
- Has the PR been silently merged or closed?
- Any merge conflicts with main?

### 7. Produce Report

Output a structured report. **Every identified item MUST have a concrete proposed action.**

```
## Upstream Watch Report — [date]
### Scan Stats
- Last scan: [date from digest or "FIRST SCAN"]
- Items checked: N | New: N | Pending: N | Reactivated: N | Unchanged (skipped): N

### ACTION REQUIRED — Act Now
- #NNN: [title] — [why] — **Action:** [specific action]

### PENDING — Awaiting User's Decision
- #NNN: [title] — [context] — **Options:** [concrete choices]

### REACTIVATED — New Activity on Decided Items
- #NNN: [title] — [was: disposition] — [N new comments] — [summary]

### Our PRs Status
- #NNN: [title] — [status]

### New Items — Not Relevant (will be set to ignore)
- #NNN: [title] — [why not relevant]

### New Items — Interesting (will be set to deferred)
- #NNN: [title] — [why interesting] — [trigger: revisit when...]
```

### 8. Update Digest (Disposition-Aware)

**After scan (update immediately):**
- `lastCommentCount` and `lastSeenAt` — for ALL items where we fetched new data
- `meta.lastScanAt` — current timestamp
- `meta.scanCount` += 1
- New items: add with `disposition: "new"`

**After user decides (update when user approves):**
- `disposition` — changes based on user's decision
- `action` — set on `implemented` items
- Items presented in report: set `disposition: "open"`

### 9. Collect Decisions via AskUserQuestion

**Do not present a flat list of numbers.** Use `AskUserQuestion` with **inline context per item**:
- Each question includes the item title, summary, and concrete options
- Group related items (e.g., an issue + its PR)

**Pattern:**
```
Question: "Algorithm v3.6.0 (PR #871) — Community PR restoring cognitive scaffolding. What should we do?"
Options: Ignore (Recommended) | Cherry-pick | Defer
```

After all decisions are collected, update digest dispositions in batch.

## Setup

1. Copy the digest template to your PAI installation:
   ```
   cp Tools/templates/UPSTREAM-DIGEST-TEMPLATE.json ~/.claude/UPSTREAM-DIGEST.json
   ```

2. Copy the patches template if you don't have one:
   ```
   cp Tools/templates/LOCAL_PATCHES-TEMPLATE.md ~/.claude/LOCAL_PATCHES.md
   ```

3. Set your GitHub username:
   ```
   export PAI_GITHUB_USER=yourusername
   ```

4. Run your first scan:
   ```
   bun Tools/UpstreamScan.ts
   ```
