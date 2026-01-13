# Workflow: Organize Documentation

**Trigger:** "organize docs", "restructure documentation", "apply diataxis", "reorganize docs"

---

## Purpose

Restructure existing documentation into Diataxis categories:
- Analyze current structure
- Classify each document
- Identify mixed-content docs to split
- Propose new structure
- Execute migration with user approval

---

## Workflow Steps

### Step 1: Read Configuration

**Read `Config.md` first.** Extract:
- Scope exclusions (what NOT to reorganize)
- Documentation location
- Role priorities (affects where to place docs)

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
cat "$PAI_DIR/skills/Diataxis-Documentation/Config.md"
```

---

### Step 2: Analyze Current Structure

Map the existing documentation:

```bash
# Show current structure
tree ./docs 2>/dev/null || find ./docs -type f -name "*.md" | head -50

# For Docusaurus
tree ./website/docs 2>/dev/null || find ./website/docs -type f -name "*.md" | head -50
```

**Document current state:**

```markdown
## Current Structure

```
docs/
├── README.md
├── getting-started.md
├── api/
│   └── reference.md
├── guides/
│   ├── installation.md
│   └── configuration.md
└── advanced/
    └── architecture.md
```

**Issues identified:**
- No clear Diataxis separation
- "guides" mixes how-to and tutorials
- "advanced" unclear category
```

---

### Step 3: Classify Each Document

Read each document and classify:

| File | Lines | Current Category | Diataxis Type | Confidence | Notes |
|------|-------|------------------|---------------|------------|-------|
| `getting-started.md` | 150 | root | Tutorial | High | Learning-oriented, hands-on |
| `api/reference.md` | 300 | api | Reference | High | Factual, complete |
| `guides/installation.md` | 80 | guides | How-to | High | Task-oriented |
| `guides/configuration.md` | 200 | guides | Mixed | Medium | Has tutorial + reference |
| `advanced/architecture.md` | 250 | advanced | Explanation | High | Conceptual |

**Classification signals:**

| Signal | Indicates |
|--------|-----------|
| "Follow along...", step-by-step learning | Tutorial |
| "To accomplish X, do Y..." | How-to |
| Tables of options, parameters, types | Reference |
| "This works because...", design rationale | Explanation |
| Multiple signals in one doc | Mixed (needs splitting) |

---

### Step 4: Identify Documents to Split

For documents classified as "Mixed":

```markdown
## Documents Requiring Splitting

### `guides/configuration.md`
**Current content:**
- Lines 1-50: Tutorial on first-time setup
- Lines 51-150: Reference for all config options
- Lines 151-200: Explanation of config architecture

**Recommended split:**
1. `tutorials/first-time-setup.md` - Lines 1-50 expanded
2. `reference/configuration.md` - Lines 51-150 reformatted
3. `concepts/configuration-architecture.md` - Lines 151-200 expanded
```

---

### Step 5: Propose New Structure

Design the target structure based on Diataxis:

```markdown
## Proposed Structure

```
docs/
├── tutorials/              # Learning-oriented
│   ├── getting-started.md
│   └── first-time-setup.md
├── how-to/                 # Task-oriented
│   ├── install.md
│   └── configure-advanced.md
├── reference/              # Information-oriented
│   ├── api.md
│   └── configuration.md
└── concepts/               # Understanding-oriented
    ├── architecture.md
    └── configuration-architecture.md
```

**For Docusaurus, update sidebars.js:**
```javascript
module.exports = {
  docs: [
    {
      type: 'category',
      label: 'Tutorials',
      items: ['tutorials/getting-started', 'tutorials/first-time-setup'],
    },
    // ...
  ],
};
```
```

---

### Step 6: Present Migration Plan

Show the user what will change:

```markdown
## Migration Plan

### Files to Move
| From | To | Action |
|------|-----|--------|
| `getting-started.md` | `tutorials/getting-started.md` | Move |
| `api/reference.md` | `reference/api.md` | Move |
| `guides/installation.md` | `how-to/install.md` | Move + rename |
| `advanced/architecture.md` | `concepts/architecture.md` | Move |

### Files to Split
| Original | New Files |
|----------|-----------|
| `guides/configuration.md` | `tutorials/first-time-setup.md`, `reference/configuration.md`, `concepts/configuration-architecture.md` |

### Directories to Create
- `tutorials/`
- `how-to/`
- `reference/`
- `concepts/`

### Directories to Remove (after migration)
- `guides/` (empty after moves)
- `advanced/` (empty after moves)
- `api/` (empty after moves)

### Files Excluded (per Config.md)
- `README.md` - Project overview, not Diataxis
```

---

### Step 7: Confirm with User

Ask for approval:

```json
{
  "header": "Migrate",
  "question": "Ready to reorganize documentation. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Execute migration (Recommended)", "description": "Move and split files as proposed"},
    {"label": "Preview changes only", "description": "Show git diff without committing"},
    {"label": "Modify plan", "description": "Adjust specific file placements"},
    {"label": "Cancel", "description": "Don't make changes"}
  ]
}
```

---

### Step 8: Execute Migration

If approved, execute:

```bash
# Create new directories
mkdir -p docs/{tutorials,how-to,reference,concepts}

# Move files
git mv docs/getting-started.md docs/tutorials/
git mv docs/api/reference.md docs/reference/api.md
git mv docs/guides/installation.md docs/how-to/install.md
git mv docs/advanced/architecture.md docs/concepts/architecture.md

# For splits: Use Write tool to create new files from extracted content
```

**For splits:**
1. Read original file
2. Extract relevant sections
3. Write new files with proper structure
4. Delete or archive original

---

### Step 9: Update Cross-References

After moving files, update internal links:

```bash
# Find broken links
grep -r "\[.*\](.*\.md)" docs/ | grep -v "http"
```

Update relative paths in moved files.

---

### Step 10: Verify Migration

```bash
# Check new structure
tree docs/

# Verify no orphaned files
find docs/ -name "*.md" -type f

# Check for broken links
# (Use link checker if available)
```

---

## Output

- Reorganized documentation structure
- Split documents where needed
- Updated cross-references
- Migration summary

---

## Rollback

If migration fails:

```bash
# Git reset if not committed
git checkout -- docs/

# Or restore from backup
git stash pop
```

---

## Related Workflows

- `PlanDocumentation.md` - Plan before organizing
- `CreateDocumentation.md` - Fill gaps after organizing
