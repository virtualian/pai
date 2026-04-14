# Apply Workflow (Two-Gate Approval)

```bash
bun ~/.pai/PAI/Tools/Notify.ts "Running the Apply workflow in the Learning skill to stage and apply approved changes"
```

Running the **Apply** workflow in the **Learning** skill to stage and apply approved changes...

**Two-gate approval: generates staged diffs for accepted proposals, then applies only human-checked changes.**

**Trigger:** "learn apply", "apply changes", "apply proposals"

---

## Overview

Apply implements a two-invocation pattern inspired by `git rebase -i`: generate diffs, let the human review, then execute. This ensures no change is written without two explicit human approvals — ACCEPTED in the review file (intent) and checkbox checked in staged changes (concrete diff).

```
  First invocation:                    Second invocation:
  ┌──────────────────┐                ┌──────────────────┐
  │ Read review.md   │                │ Read staged-     │
  │ Collect ACCEPTED │                │   changes.md     │
  │ Generate diffs   │                │ Apply checked    │
  │ Write staged-    │                │   changes        │
  │   changes.md     │                │ Update review.md │
  │ Tell user to     │                │ Delete staged-   │
  │   review         │                │   changes.md     │
  └──────────────────┘                └──────────────────┘
```

---

## Invocation Detection

**How to determine which invocation this is:**

```
Check if ~/.pai/MEMORY/LEARNING/staged-changes.md exists.

If it exists → This is the SECOND invocation (apply checked changes)
If it does not exist → This is the FIRST invocation (generate staged changes)
```

---

## First Invocation: Generate Staged Changes

### Step 1: Read Review File

```
Read ~/.pai/MEMORY/LEARNING/review.md
Parse all proposals and their statuses.
Collect only proposals with status ACCEPTED.

If no ACCEPTED proposals exist:
  - Output: "No accepted proposals found. Open review.md and change
    PENDING proposals to ACCEPTED, then run /learn apply again."
  - Exit
```

### Step 2: Read Target Files

For each ACCEPTED proposal, read the current state of its target file:

| Target | File to Read |
|--------|-------------|
| Algorithm spec | Read `~/.pai/PAI/Algorithm/LATEST` to get version, then read `~/.pai/PAI/Algorithm/v{VERSION}.md` |
| AISTEERINGRULES.md | Read `~/.pai/PAI/AISTEERINGRULES.md` |
| Feedback memories | Read the PAI feedback memory directory `~/.pai/MEMORY/FEEDBACK/` to understand existing structure. If the directory does not exist yet, there are no existing feedback memories. |

### Step 3: Generate Concrete Diffs

For each ACCEPTED proposal, generate a concrete edit against the **current** target file:

**Per-target mechanics:**

| Target | How to Generate Diff |
|--------|---------------------|
| **Algorithm spec** | Section-aware edit. Read the spec structure, identify the correct section using the Algorithm Section Routing Table (from Review workflow). Generate a diff that inserts, replaces, or augments the specific section. Most changes are additions or rewording of existing steps. |
| **AISTEERINGRULES.md** | Append. Almost always a new rule added to an existing section. Identify the appropriate section in AISTEERINGRULES.md and generate an append diff. Simplest target. |
| **Feedback memories** | File-based. Generate a new memory file with proper frontmatter (name, description, type: feedback). The file will be written to `~/.pai/MEMORY/FEEDBACK/` (global, not per-cwd). |

**Edge cases to handle:**
- **Target file changed since proposal:** Diffs are generated against the current file, not a snapshot from proposal time. If someone already made the change by hand, detect the overlap and flag it rather than duplicating.
- **Multiple proposals touching same file:** Process in proposal order (LP-007 before LP-008). Each subsequent diff is generated against the file as modified by prior diffs in the batch. The staged output shows the cumulative result.

### Step 4: Write staged-changes.md

```
Write ~/.pai/MEMORY/LEARNING/staged-changes.md

With YAML frontmatter:
---
staged_at: [ISO timestamp]
source: MEMORY/LEARNING/review.md
proposals: [LP-007, LP-008, ...]
---

# Staged Changes

[For each ACCEPTED proposal:]

## LP-[NNN] — [Title]
- Target: `[target file path]`
- Section: [specific section in target file]
- Action: [Insert after line N / Replace lines N-M / Append / New file]

```diff
[The actual diff — showing context lines with prefix, additions with +, removals with -]
```

- [x] Apply this change

---

[Repeat for each proposal. Checkboxes default to CHECKED.]
```

### Step 5: Tell User to Review

Output:

```
## Staged Changes Ready

**Location:** `~/.pai/MEMORY/LEARNING/staged-changes.md`
**Proposals staged:** [N]

### What to Do

1. Open `staged-changes.md`
2. Review each diff — these are the concrete changes that will be written
3. Uncheck any proposals you don't want applied (change `[x]` to `[ ]`)
4. Save the file
5. Run `/learn apply` again to execute the checked changes

Checkboxes default to checked. The conservative action is to uncheck what you don't want.
Unchecked proposals stay ACCEPTED — they'll be re-staged on the next apply run.
```

---

## Second Invocation: Apply Checked Changes

### Step 6: Read Staged Changes

```
Read ~/.pai/MEMORY/LEARNING/staged-changes.md
Parse each proposal section:
- Extract LP-xxx ID
- Check if the checkbox is checked ([x]) or unchecked ([ ])
- Extract the target file path
- Extract the diff content
```

### Step 7: Apply Checked Changes

For each proposal where the checkbox is checked (`[x]`):

**Per-target apply mechanics:**

| Target | How to Apply |
|--------|-------------|
| **Algorithm spec** | Section-aware Edit. Read the current spec, find the target section, apply the insert/replace/augment using the Edit tool. Verify the edit was applied correctly by re-reading the section. |
| **AISTEERINGRULES.md** | Append. Read the current file, find the target section, use the Edit tool to append the new rule. |
| **Feedback memories** | Write new file. Use the Write tool to create a new memory file at the appropriate path with proper frontmatter. Then update MEMORY.md index if applicable. |

For each proposal where the checkbox is unchecked (`[ ]`):
- Skip — do not apply
- The proposal stays ACCEPTED in review.md for the next apply cycle

### Step 8: Update Review File

```
Read ~/.pai/MEMORY/LEARNING/review.md
For each proposal that was successfully applied:
  - Change status from ACCEPTED to APPLIED
  - Add applied timestamp: `- Applied: [ISO timestamp]`

For each proposal that was skipped (unchecked):
  - Keep status as ACCEPTED (unchanged)

Write the updated review.md
```

### Step 9: Clean Up

```
Delete ~/.pai/MEMORY/LEARNING/staged-changes.md
(It's transient — regenerated each apply run)
```

### Step 10: Report Results

Output:

```
## Changes Applied

**Applied:** [N] proposals
**Skipped:** [N] proposals (stayed ACCEPTED for next cycle)

### Applied Changes
- LP-[NNN] — [Title] → [target file] ✅
- LP-[NNN] — [Title] → [target file] ✅

### Skipped (Still ACCEPTED)
- LP-[NNN] — [Title] (unchecked in staged changes)

The review file has been updated. Applied proposals are marked APPLIED with timestamp.
```

---

## Integration

- **From Review:** Natural next step after human edits review.md
- **Idempotent re-staging:** If staged-changes.md doesn't exist, always regenerates from current ACCEPTED proposals against current target files
- **Safe rollback:** Changes are applied via Edit tool, so git history provides rollback
