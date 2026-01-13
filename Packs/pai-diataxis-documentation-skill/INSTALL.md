# PAI Diataxis Documentation Skill v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a simple file-copy installation.** The skill installs once globally; per-project configuration happens on first use.

### Welcome Message

```
"I'm installing PAI Diataxis Documentation Skill v1.0.0 - a documentation methodology based on the Diataxis framework.

This installs the skill to your system. When you first use it in a project, I'll help configure a docs site for that specific project."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for PAI directory
PAI_CHECK="${PAI_DIR:-$HOME/.claude}"
echo "PAI_DIR: $PAI_CHECK"

# Check if pai-core-install is installed (REQUIRED)
if [ -f "$PAI_CHECK/skills/CORE/SKILL.md" ]; then
  echo "✓ pai-core-install is installed"
else
  echo "❌ pai-core-install NOT installed - REQUIRED!"
fi

# Check for existing Diataxis-Documentation skill
if [ -d "$PAI_CHECK/skills/Diataxis-Documentation" ]; then
  echo "⚠️  Existing Diataxis-Documentation skill found"
  ls -la "$PAI_CHECK/skills/Diataxis-Documentation/"
else
  echo "✓ No existing Diataxis-Documentation skill (clean install)"
fi
```

### 1.2 Present Findings

```
"Here's what I found:
- pai-core-install: [installed / NOT INSTALLED - REQUIRED]
- Existing skill: [Yes / No]"
```

**STOP if pai-core-install is not installed.** Tell the user:
```
"pai-core-install is required. Please install it first, then return to install this pack."
```

---

## Phase 2: Conflict Resolution (if needed)

**Only ask if existing skill detected:**

```json
{
  "header": "Conflict",
  "question": "Existing Diataxis-Documentation skill detected. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup, then installs new version"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing"}
  ]
}
```

### Backup (if chosen)

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
BACKUP_DIR="$PAI_DIR/Backups/diataxis-documentation-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$PAI_DIR/skills/Diataxis-Documentation" ] && cp -r "$PAI_DIR/skills/Diataxis-Documentation" "$BACKUP_DIR/"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 3: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating directory structure"},
    {"content": "Copy skill files from pack", "status": "pending", "activeForm": "Copying skill files"},
    {"content": "Copy workflow files", "status": "pending", "activeForm": "Copying workflow files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 3.1 Create Skill Directory Structure

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
mkdir -p "$PAI_DIR/skills/Diataxis-Documentation/Workflows"
```

### 3.2 Copy Skill Files

```bash
# From the pack directory (where this INSTALL.md is located)
PACK_DIR="$(pwd)"
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

cp "$PACK_DIR/src/skills/Diataxis-Documentation/SKILL.md" "$PAI_DIR/skills/Diataxis-Documentation/"
cp "$PACK_DIR/src/skills/Diataxis-Documentation/Standard.md" "$PAI_DIR/skills/Diataxis-Documentation/"
```

**Files copied:**
- `SKILL.md` - Main skill routing and Diataxis methodology
- `Standard.md` - Diataxis framework documentation

### 3.3 Copy Workflow Files

```bash
PACK_DIR="$(pwd)"
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

cp "$PACK_DIR/src/skills/Diataxis-Documentation/Workflows/"*.md "$PAI_DIR/skills/Diataxis-Documentation/Workflows/"
```

**Workflows copied:**
- `InitializeProject.md` - First-use project configuration (creates docs site)
- `PlanDocumentation.md` - Documentation planning and gap analysis
- `OrganizeDocumentation.md` - Restructuring existing documentation
- `CreateDocumentation.md` - Writing new documentation

---

## Phase 4: Verification

**Execute all checks from VERIFY.md:**

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

echo "=== PAI Diataxis Documentation Skill Verification ==="

# Check skill files exist
echo "Checking skill files..."
[ -f "$PAI_DIR/skills/Diataxis-Documentation/SKILL.md" ] && echo "✓ SKILL.md" || echo "❌ SKILL.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Standard.md" ] && echo "✓ Standard.md" || echo "❌ Standard.md missing"

# Check workflow files
echo ""
echo "Checking workflow files..."
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/InitializeProject.md" ] && echo "✓ InitializeProject.md" || echo "❌ InitializeProject.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/PlanDocumentation.md" ] && echo "✓ PlanDocumentation.md" || echo "❌ PlanDocumentation.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/OrganizeDocumentation.md" ] && echo "✓ OrganizeDocumentation.md" || echo "❌ OrganizeDocumentation.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/CreateDocumentation.md" ] && echo "✓ CreateDocumentation.md" || echo "❌ CreateDocumentation.md missing"

echo "=== Verification Complete ==="
```

---

## Success Message

```
"PAI Diataxis Documentation Skill v1.0.0 installed successfully!

The skill is now available globally. When you first use it in a project, I'll help you:
- Choose documentation technology (Docusaurus, MkDocs, etc.)
- Configure hosting (GitHub Pages, Vercel, etc.)
- Set up your docs site structure

Try it in any project:
- 'Set up documentation for this project'
- 'Plan documentation for this project'
- 'Create a how-to guide for X'"
```

---

## What's Included

| File | Purpose |
|------|---------|
| `SKILL.md` | Main skill definition with workflow routing |
| `Standard.md` | Complete Diataxis framework documentation |
| `Workflows/InitializeProject.md` | First-use project configuration |
| `Workflows/PlanDocumentation.md` | Documentation planning workflow |
| `Workflows/OrganizeDocumentation.md` | Documentation restructuring workflow |
| `Workflows/CreateDocumentation.md` | New documentation creation workflow |

---

## Troubleshooting

### "pai-core-install not found"

This pack requires pai-core-install. Install it first.

### Skill not being invoked

Check the skill is in the correct location:
```bash
ls -la $PAI_DIR/skills/Diataxis-Documentation/
```

The skill auto-activates when you mention documentation, docs, tutorials, how-to guides, reference docs, or explanation docs.
