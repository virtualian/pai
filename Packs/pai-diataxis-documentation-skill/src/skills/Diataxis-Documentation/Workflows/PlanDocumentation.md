# Workflow: Plan Documentation

**Trigger:** "plan documentation", "documentation plan", "what docs do we need", "documentation gap analysis"

---

## Purpose

Create a comprehensive documentation plan based on:
- User's configured roles and priorities (from `docs/.diataxis.md`)
- Existing documentation inventory
- Diataxis framework requirements
- Gap analysis

---

## Workflow Steps

### Step 1: Read Project Configuration

**Read the project's `docs/.diataxis.md` first.** Extract:
- Roles and their priorities
- Diataxis elements prioritized per role
- Documentation sources
- Scope exclusions

```bash
# Check project config exists
cat ./docs/.diataxis.md
```

**If `docs/.diataxis.md` missing:** Run `InitializeProject.md` first.

---

### Step 2: Inventory Existing Documentation

Scan for markdown files in the documentation location:

```bash
# Find all markdown files in docs/
find ./docs -name "*.md" -type f 2>/dev/null | head -50

# For Docusaurus projects
find ./website/docs -name "*.md" -type f 2>/dev/null | head -50
```

**For each file found:**
1. Read the content
2. Determine current Diataxis type (or "mixed/unclear")
3. Note the apparent audience

---

### Step 3: Classify Existing Docs

Create an inventory table with **temporal awareness**:

| File | Current Type | Target Type | Temporal State | Audience | Action Needed |
|------|--------------|-------------|----------------|----------|---------------|
| `getting-started.md` | Tutorial | Tutorial | Current | developers | Keep |
| `api.md` | Mixed | Reference | Mixed | developers | Split |
| `oauth1.md` | How-to | - | Deprecated | developers | Archive/Remove |
| `roadmap.md` | Explanation | Explanation | Planned | all | Mark as planned |

**Classification criteria:**
- Has step-by-step hands-on? → Tutorial
- Goal-oriented task instructions? → How-to
- Factual specification? → Reference
- Conceptual explanation? → Explanation
- Multiple types mixed? → Mixed (needs splitting)

**Temporal classification:**
- References current code/features? → `Current`
- Mentions deprecated/legacy features? → `Deprecated`
- Describes removed functionality? → `Removed` (candidate for deletion)
- Discusses future/planned features? → `Planned`
- Covers experimental features? → `Experimental`
- Mixes multiple temporal states? → `Mixed` (needs splitting)

---

### Step 4: Apply Reorganization Exemptions

Remove from the reorganization inventory (these files stay where they are):
- Files listed in `docs/.diataxis.md` exemptions
- Files serving platform/tooling purposes

**Common exempt files:**
- README.md, LICENSE, CONTRIBUTING.md, CHANGELOG.md
- CODE_OF_CONDUCT.md, SECURITY.md
- .github/*.md
- SKILL.md files

> **Note:** Exempt files are excluded from reorganization only. They may still be used as **source material** in Step 5 when generating documentation content.

---

### Step 5: Inventory Documentation Sources

Scan `docs/.diataxis.md` sources to understand what content can be derived:

```bash
# Check configured sources exist
# Source 1: existing docs
find ./docs -name "*.md" -type f | wc -l

# Source 2: code comments
grep -r "@param\|@returns\|@example\|@deprecated" src/ --include="*.ts" | wc -l

# Source 3: README files
find . -name "README.md" -type f

# Check for temporal signals
grep -r "deprecated\|legacy\|planned\|experimental\|removed" --include="*.md" --include="*.ts" .
```

**Source quality assessment:**

| Source | Files | Temporal Signals | Notes |
|--------|-------|------------------|-------|
| docs/ | 12 | 3 deprecated, 2 planned | Main source |
| Code comments | 45 | 5 @deprecated | API reference source |
| README.md | 1 | None | Overview only |
| CHANGELOG.md | 1 | Full history | Temporal ground truth |

---

### Step 6: Gap Analysis

For each role in `docs/.diataxis.md` (by priority):

1. **List required content types** (from `docs/.diataxis.md` elements table)
2. **Check existing coverage:**
   - Tutorial coverage for this role?
   - How-to coverage for this role?
   - Reference coverage for this role?
   - Explanation coverage for this role?
3. **Identify gaps:** Missing content types for priority roles

**Output gap analysis:**

```markdown
## Gap Analysis: [Role]

### Required (from docs/.diataxis.md)
- ✓ How-to guides
- ✓ Reference docs
- ✓ Explanation

### Current State
- How-to: 3 docs (deploy, configure, integrate)
- Reference: 1 doc (API) - incomplete
- Explanation: 0 docs - MISSING

### Gaps
1. Reference: API reference incomplete (missing endpoints X, Y)
2. Explanation: No architecture documentation
3. Explanation: No design decisions documented
```

---

### Step 7: Prioritize Recommendations

Order recommendations by:
1. **Role priority** (primary > secondary > tertiary)
2. **Gap severity** (missing > incomplete > improve)
3. **Content type priority** (from `docs/.diataxis.md`)

---

### Step 8: Present Plan

Output the documentation plan:

```markdown
# Documentation Plan

## Executive Summary
[1-2 sentences on current state and main gaps]

## Inventory
[Table from Step 3]

## Gap Analysis
[Analysis from Step 5, by role]

## Recommended Actions

### High Priority
1. [Action] - [Rationale based on role/type priority]
2. ...

### Medium Priority
1. ...

### Low Priority
1. ...

## Proposed Structure
[Recommended directory structure]

## Next Steps
- [ ] Confirm plan with stakeholders
- [ ] Begin with highest-priority items
- [ ] Schedule review after initial docs created
```

---

### Step 9: Confirm with User

Ask the user:
```json
{
  "header": "Plan",
  "question": "Documentation plan ready. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Approve plan", "description": "Save plan and begin implementation"},
    {"label": "Modify priorities", "description": "Adjust which items to tackle first"},
    {"label": "More detail on gaps", "description": "Expand analysis for specific areas"},
    {"label": "Save for later", "description": "Save plan without acting"}
  ]
}
```

---

## Output Artifacts

- Documentation plan (can be saved to `docs/DOCUMENTATION-PLAN.md`)
- Gap analysis by role
- Prioritized action items

---

## Related Workflows

- `OrganizeDocumentation.md` - Restructure existing docs based on plan
- `CreateScaffold.md` + `GenerateContent.md` - Create new docs identified in gaps
