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

### Step 1: Read Project Configuration

**Read the project's `docs/.diataxis.md` first.** Extract:
- Scope exclusions (what NOT to reorganize)
- Documentation location
- Role priorities (affects where to place docs)

```bash
cat ./docs/.diataxis.md
```

**If `docs/.diataxis.md` missing:** Run `InitializeProject.md` first.

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

**Recommended split (role-first):**
1. `users/tutorials/first-time-setup.md` - Lines 1-50 expanded
2. `developers/reference/configuration.md` - Lines 51-150 reformatted
3. `developers/explanation/configuration-architecture.md` - Lines 151-200 expanded
```

---

### Step 5: Propose New Structure

Design the target structure based on Diataxis (role-first):

```markdown
## Proposed Structure

```
docs/
├── users/                  # End users
│   ├── tutorials/
│   │   ├── getting-started.md
│   │   └── first-time-setup.md
│   └── how-to/
│       └── install.md
└── developers/             # Developers/integrators
    ├── how-to/
    │   └── configure-advanced.md
    ├── reference/
    │   ├── api.md
    │   └── configuration.md
    └── explanation/
        ├── architecture.md
        └── configuration-architecture.md
```

**For Docusaurus, update sidebars.js:**
```javascript
module.exports = {
  docs: [
    {
      type: 'category',
      label: 'Users',
      items: [
        { type: 'category', label: 'Tutorials', items: ['users/tutorials/getting-started'] },
        { type: 'category', label: 'How-to', items: ['users/how-to/install'] },
      ],
    },
    {
      type: 'category',
      label: 'Developers',
      items: [
        { type: 'category', label: 'Reference', items: ['developers/reference/api'] },
      ],
    },
  ],
};
```
```

---

### Step 6: Present Migration Plan

Show the user what will change (role-first structure):

```markdown
## Migration Plan

### Files to Move
| From | To | Action |
|------|-----|--------|
| `getting-started.md` | `users/tutorials/getting-started.md` | Move |
| `api/reference.md` | `developers/reference/api.md` | Move |
| `guides/installation.md` | `users/how-to/install.md` | Move + rename |
| `advanced/architecture.md` | `developers/explanation/architecture.md` | Move |

### Files to Split
| Original | New Files |
|----------|-----------|
| `guides/configuration.md` | `users/tutorials/first-time-setup.md`, `developers/reference/configuration.md`, `developers/explanation/configuration-architecture.md` |

### Directories to Create (role-first)
- `users/tutorials/`
- `users/how-to/`
- `developers/reference/`
- `developers/explanation/`

### Directories to Remove (after migration)
- `guides/` (empty after moves)
- `advanced/` (empty after moves)
- `api/` (empty after moves)

### Files Excluded (per docs/.diataxis.md)
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
# Create role-first directories (based on roles in .diataxis.md)
# Example for users + developers roles:
mkdir -p docs/users/{tutorials,how-to,reference}
mkdir -p docs/developers/{tutorials,how-to,reference,explanation}

# Move files to appropriate role + content type
git mv docs/getting-started.md docs/users/tutorials/
git mv docs/api/reference.md docs/developers/reference/api.md
git mv docs/guides/installation.md docs/users/how-to/install.md
git mv docs/advanced/architecture.md docs/developers/explanation/architecture.md

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
- `CreateScaffold.md` + `GenerateContent.md` - Fill gaps after organizing
