# Workflow: Create Scaffold

**Trigger:** "create scaffold", "new doc scaffold", "scaffold for [type]"

---

## Purpose

Create the structural skeleton for a new documentation file:
- Determine correct content type
- Apply appropriate structure template
- Create file in correct location
- Ready for content generation

**Design Principle:** This workflow is agnostic to project type, tech stack, hosting, and content domain. All project-specific configuration comes from `docs/.diataxis.md`.

---

## Workflow Steps

### Step 0: Validate Configuration

**CRITICAL: Run before any other step. See SKILL.md "Config Change Detection" for full reference.**

**If `docs/.diataxis.md` missing:** Run `InitializeProject.md` first, then return here.

```bash
# 1. Read config
cat ./docs/.diataxis.md

# 2. Extract structural fields
TECHNOLOGY=$(grep -oP '(?<=\*\*Technology:\*\* ).*' ./docs/.diataxis.md | head -1)
CONTEXT=$(grep -oP '(?<=\*\*Context:\*\* ).*' ./docs/.diataxis.md | head -1)
ROLES=$(grep -E '^\| \w' ./docs/.diataxis.md | grep -v 'Role' | awk -F'|' '{print $2}' | xargs)

# 3. Determine docs content path
case "$TECHNOLOGY" in
  *Docusaurus*) [ "$CONTEXT" = "within_project" ] && DOCS_PATH="website/docs" || DOCS_PATH="docs" ;;
  *MkDocs*)     DOCS_PATH="docs" ;;
  *Starlight*)  [ "$CONTEXT" = "within_project" ] && DOCS_PATH="docs/src/content/docs" || DOCS_PATH="src/content/docs" ;;
  *)            [ "$CONTEXT" = "within_project" ] && DOCS_PATH="docs" || DOCS_PATH="." ;;
esac

# 4. Check for missing role directories
MISSING_DIRS=""
ORPHANED_DIRS=""
for role in $ROLES; do
  [ ! -d "$DOCS_PATH/$role" ] && MISSING_DIRS="$MISSING_DIRS $role"
done

# 5. Check for orphaned role directories (dirs that exist but aren't in config)
if [ -d "$DOCS_PATH" ]; then
  for dir in "$DOCS_PATH"/*/; do
    [ ! -d "$dir" ] && continue
    dirname=$(basename "$dir")
    case "$dirname" in _*|node_modules|.git|src|static|build) continue ;; esac
    echo "$ROLES" | grep -qw "$dirname" || ORPHANED_DIRS="$ORPHANED_DIRS $dirname"
  done
fi

echo "MISSING_DIRS:$MISSING_DIRS"
echo "ORPHANED_DIRS:$ORPHANED_DIRS"
```

**If drift detected (MISSING_DIRS or ORPHANED_DIRS non-empty):**

Present changes to user via AskUserQuestion (see SKILL.md "Config Change Detection" → User Confirmation).

**On "Apply changes":**
- Create missing role directories with their content type subdirectories
- For orphaned empty directories: remove silently
- For orphaned directories with content: ask user (archive to `docs/_archive/`, delete, or keep)

**On "Skip validation":** Proceed to Step 1 with current filesystem as-is.

**On "Re-initialize":** Route to `InitializeProject.md`.

---

### Step 1: Read Project Configuration

**Read the project's `docs/.diataxis.md` first.** This file defines:
- Documentation directory structure
- File naming conventions
- Folder paths per content type
- Any project-specific patterns

```bash
# Project-specific config (created by InitializeProject)
cat ./docs/.diataxis.md
```

If `docs/.diataxis.md` doesn't exist, run `InitializeProject.md` first.

---

### Step 2: Determine Content Type

If not specified by user, determine the appropriate Diataxis type:

```
Is the user trying to LEARN something new?
├─ YES → Is it practical (hands-on)?
│        ├─ YES → TUTORIAL
│        └─ NO  → EXPLANATION
└─ NO  → Does the user have a specific GOAL?
         ├─ YES → HOW-TO GUIDE
         └─ NO  → REFERENCE
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

**Read paths from `docs/.diataxis.md`** - do not assume folder names.

**Role-first structure:** Documentation is organized by role first, then content type:
- `users/tutorials/` - Tutorials for end users
- `developers/reference/` - API reference for developers
- `contributors/how-to/` - Contribution guides

**Ask which role this doc serves if unclear:**

```json
{
  "header": "Audience",
  "question": "Who is this documentation for?",
  "multiSelect": false,
  "options": [
    {"label": "Users", "description": "End users of the application"},
    {"label": "Developers", "description": "People integrating with or extending the project"},
    {"label": "Operators", "description": "DevOps/SRE deploying and running the system"},
    {"label": "Contributors", "description": "People contributing to the project"}
  ]
}
```

**File naming:** Follow the project's existing convention:
- Check existing files in the target folder
- Match case style (TitleCase, kebab-case, snake_case)
- Match extension (.md, .mdx)

---

### Step 4: Create Scaffold

Use the appropriate structure template. **Critical rules:**

1. **NO placeholder links** - Links that don't resolve will break builds
2. **VISIBLE placeholders** - Use `[TODO: ...]` not HTML comments
3. **Minimal structure** - Only include sections that WILL be filled

#### Tutorial Scaffold

```markdown
# Tutorial: [TODO: Meaningful Project Name]

[TODO: Brief description of what the reader will build - make it compelling]

## Prerequisites

[TODO: List required tools, knowledge, or setup]

## Steps

### Step 1: [TODO: Action Verb] [TODO: Object]

[TODO: Content to be generated by GenerateContent workflow]

## What You Learned

[TODO: List 2-3 concepts the reader now understands]

## Next Steps

[TODO: Suggest what to learn or do next - add links only when targets exist]
```

#### How-to Guide Scaffold

```markdown
# How to [TODO: Accomplish Specific Goal]

[TODO: One sentence describing what this guide helps accomplish]

## Prerequisites

[TODO: List required access, tools, or knowledge]

## Steps

### 1. [TODO: Action verb] [TODO: object]

[TODO: Content to be generated by GenerateContent workflow]

## Verification

[TODO: How to confirm success]

## Troubleshooting

[TODO: Common problems and solutions - or remove section if none known]
```

#### Reference Scaffold

```markdown
# [TODO: Component/API/Module Name] Reference

[TODO: One sentence description]

## [TODO: Section Name]

### [TODO: Item Name]

| Property | Value |
|----------|-------|
| Type | [TODO] |
| Default | [TODO] |
| Required | [TODO] |

[TODO: Description]

**Example:**

```
[TODO: Usage example]
```
```

#### Explanation Scaffold

```markdown
# [TODO: Topic]: [TODO: Aspect Being Explained]

[TODO: What this explanation covers and why it matters]

## Background

[TODO: Context needed to understand this topic]

## [TODO: Main Concept]

[TODO: Content to be generated by GenerateContent workflow]

## Design Decisions

[TODO: Why things are the way they are - or remove if not applicable]

## Trade-offs

[TODO: What was gained and lost - or remove if not applicable]
```

---

### Step 5: Pre-Write Validation

Before writing the scaffold, verify:

| Check | Requirement |
|-------|-------------|
| Target folder exists | Create if missing |
| No file name collision | Don't overwrite existing files |
| No broken links | Scaffold contains zero internal links |
| Visible placeholders | All TODOs use `[TODO: ...]` format |

---

### Step 6: Write Scaffold File

Use the Write tool to create the file.

**After writing:**
1. Confirm file was created
2. Report the path to the user
3. Note that `GenerateContent` workflow should be run next

---

## Output

- New scaffold file in project-defined location
- Structure matches Diataxis type
- All placeholders visible as `[TODO: ...]`
- Zero internal links (prevents broken link errors)
- Ready for GenerateContent workflow

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Instead |
|--------------|---------|---------|
| `<!-- placeholder -->` | Invisible, gets forgotten | `[TODO: description]` |
| `[link](/path/to/future)` | Breaks build if target missing | Omit links until targets exist |
| `docs/tutorials/*.md` | Assumes folder structure | Read from `.diataxis.md` |
| `kebab-case (for Docusaurus)` | Tech-specific assumption | Match project's existing style |
| Including all optional sections | Bloat, empty sections | Only include sections that will be filled |

---

## Related Workflows

- `GenerateContent.md` - Fill scaffold with content
- `InitializeProject.md` - Creates `docs/.diataxis.md` config
- `PlanDocumentation.md` - Plan what docs to create
