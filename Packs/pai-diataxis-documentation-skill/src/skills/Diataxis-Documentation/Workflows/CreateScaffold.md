# Workflow: Create Scaffold

**Trigger:** "create scaffold", "new doc scaffold", "scaffold for [type]"

---

## Purpose

Create the structural skeleton for a new documentation file:
- Determine correct content type
- Apply appropriate structure template
- Create file in correct location
- Ready for content generation

---

## Workflow Steps

### Step 1: Read Configuration

**Read `Config.md` first.** Extract:
- Target roles and their priorities
- Content type priorities per role
- Documentation location
- Any relevant notes

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
cat "$PAI_DIR/skills/Diataxis-Documentation/Config.md"
```

---

### Step 2: Determine Content Type

If not specified by user, determine the appropriate Diataxis type:

```markdown
## Content Type Decision Tree

Is the user trying to LEARN something new?
├─ YES → Is it practical (hands-on)?
│        ├─ YES → **TUTORIAL**
│        └─ NO  → **EXPLANATION**
└─ NO  → Does the user have a specific GOAL?
         ├─ YES → **HOW-TO GUIDE**
         └─ NO  → **REFERENCE**
```

**Ask if unclear:**

```json
{
  "header": "Doc Type",
  "question": "What kind of documentation are you creating?",
  "multiSelect": false,
  "options": [
    {"label": "Tutorial", "description": "Learning-oriented, hands-on guide for newcomers"},
    {"label": "How-to Guide", "description": "Task-oriented steps to accomplish a specific goal"},
    {"label": "Reference", "description": "Factual, complete technical specification"},
    {"label": "Explanation", "description": "Conceptual content explaining why things work"}
  ]
}
```

---

### Step 3: Determine File Location

Based on Diataxis type and Config.md:

| Type | Location |
|------|----------|
| Tutorial | `docs/tutorials/[name].md` |
| How-to | `docs/how-to/[name].md` |
| Reference | `docs/reference/[name].md` |
| Explanation | `docs/concepts/[name].md` |

**File naming:**
- Use TitleCase: `GettingStarted.md`
- Or kebab-case: `getting-started.md` (for Docusaurus)
- Be descriptive: `DeployToAWS.md` not `deploy.md`

---

### Step 4: Create Scaffold

Use the appropriate structure template from `Standard.md`:

#### Tutorial Scaffold
```markdown
# Tutorial: [Meaningful Project Name]

## What You'll Build
<!-- Brief description of the end result - make it compelling -->

## Prerequisites
- [ ] <!-- Tool/knowledge required -->

## Steps

### Step 1: [Action Verb] [Object]
<!-- Content to be generated -->

## What You've Learned
- <!-- Concept 1 -->
- <!-- Concept 2 -->

## Next Steps
- <!-- Link to related tutorial -->
- <!-- Link to how-to for advanced usage -->
```

#### How-to Guide Scaffold
```markdown
# How to [Accomplish Specific Goal]

## Overview
<!-- One sentence: what this guide helps you accomplish -->

## Prerequisites
- [ ] <!-- Required tool/access/knowledge -->

## Steps

### 1. [Action verb] [object]
<!-- Content to be generated -->

## Verification
<!-- How to confirm success -->

## Troubleshooting

### [Common problem]
<!-- Solution -->

## Related
- <!-- Link to related how-to -->
- <!-- Link to reference -->
```

#### Reference Scaffold
```markdown
# [Component/API/Module Name] Reference

## Overview
<!-- One sentence description -->

## [Section Name]

### [Item Name]

| Property | Value |
|----------|-------|
| Type | <!-- type --> |
| Default | <!-- default --> |
| Required | <!-- yes/no --> |

<!-- Description -->

**Example:**
```code
<!-- Usage example -->
```

## See Also
- <!-- Related reference -->
- <!-- How-to using this -->
```

#### Explanation Scaffold
```markdown
# [Topic]: [Aspect Being Explained]

## Overview
<!-- What this explanation covers and why it matters -->

## Background
<!-- Context needed to understand -->

## [Main Concept]
<!-- Content to be generated -->

## Design Decisions
<!-- Why things are the way they are -->

## Trade-offs
<!-- What was gained and lost in this design -->

## Related Concepts
- <!-- Link to related explanation -->
- <!-- Link to tutorial using this concept -->
```

---

### Step 5: Write Scaffold File

Use the Write tool to create the file with the scaffold structure.

---

## Output

- New scaffold file in correct location
- Structure matches Diataxis type
- Placeholder comments where content will go
- Ready for GenerateContent workflow

---

## Related Workflows

- `GenerateContent.md` - Fill scaffold with content
- `PlanDocumentation.md` - Plan what docs to create
