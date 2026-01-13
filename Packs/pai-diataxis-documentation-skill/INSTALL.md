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

# Check for existing Diataxis-Documentation skill and version
if [ -d "$PAI_CHECK/skills/Diataxis-Documentation" ]; then
  echo "⚠️  Existing Diataxis-Documentation skill found"
  # Extract installed version
  INSTALLED_VERSION=$(grep -E "^version:" "$PAI_CHECK/skills/Diataxis-Documentation/SKILL.md" 2>/dev/null | cut -d' ' -f2 || echo "unknown")
  echo "Installed version: $INSTALLED_VERSION"
  # Pack version (update this when releasing new versions)
  PACK_VERSION="1.0.0"
  echo "Pack version: $PACK_VERSION"
  if [ "$INSTALLED_VERSION" = "$PACK_VERSION" ]; then
    echo "✓ Already up to date"
  else
    echo "↑ Update available: $INSTALLED_VERSION → $PACK_VERSION"
  fi
else
  echo "✓ No existing Diataxis-Documentation skill (clean install)"
fi
```

### 1.2 Present Findings

```
"Here's what I found:
- pai-core-install: [installed / NOT INSTALLED - REQUIRED]
- Existing skill: [Yes (version X.X.X) / No]
- Update available: [Yes (X.X.X → Y.Y.Y) / No / N/A]"
```

**STOP if pai-core-install is not installed.** Tell the user:
```
"pai-core-install is required. Please install it first, then return to install this pack."
```

---

## Phase 2: Update or Install

### If Update Available (existing skill, newer pack version)

**Use this streamlined flow for updates:**

```json
{
  "header": "Update",
  "question": "Update available (X.X.X → Y.Y.Y). How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Update skill files (Recommended)", "description": "Updates skill files only. Project configs (docs/.diataxis.md) are preserved."},
    {"label": "Skip update", "description": "Keep current version"}
  ]
}
```

**If user chooses Update:**
- Skip to Phase 3 (Installation) - just overwrite skill files
- No backup needed for minor updates (skill files only)
- Project configs (`docs/.diataxis.md`) are NOT touched

### If Already Up To Date

Tell the user:
```
"Skill is already at version X.X.X (latest). No update needed.

If you're having issues, you can force reinstall with 'Backup and Replace'."
```

### If Fresh Install or Force Reinstall

**Only ask if existing skill detected AND user wants to force reinstall:**

```json
{
  "header": "Install",
  "question": "Existing Diataxis-Documentation skill detected. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace", "description": "Creates timestamped backup, then installs fresh"},
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

## Updating Project Configs

**Project configs (`docs/.diataxis.md`) are separate from skill updates.**

If a new skill version requires config changes:

1. Check config version (if present):
   ```bash
   grep -E "^<!-- config-version:" ./docs/.diataxis.md 2>/dev/null || echo "No version found"
   ```

2. If migration needed, the skill will prompt during next use:
   ```
   "Your project config was created with an older skill version.
   I can help migrate it to the new format. Want me to proceed?"
   ```

3. Migration preserves user choices, only updates structure if needed

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

### 3.3 Record Install Source

**Record the actual location the skill was installed from:**

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_FILE="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"
PACK_DIR="$(pwd)"

# Record the actual install source (local path or git repo)
# This is where the user ran the install from
INSTALL_SOURCE="$PACK_DIR"

# If it's a git repo, also note the remote for context
if [ -d ".git" ]; then
  GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$GIT_REMOTE" ]; then
    # Convert SSH to HTTPS format if needed
    GIT_REMOTE=$(echo "$GIT_REMOTE" | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
    INSTALL_SOURCE="$PACK_DIR (from $GIT_REMOTE)"
  fi
fi

# Update SKILL.md with actual install source
sed -i.bak "s|^install_source:.*|install_source: $INSTALL_SOURCE|" "$SKILL_FILE"
rm -f "$SKILL_FILE.bak"

echo "Install source recorded: $INSTALL_SOURCE"
echo "Official source (for updates): https://github.com/danielmiessler/Personal_AI_Infrastructure"
```

**Files copied:**
- `SKILL.md` - Main skill routing and Diataxis methodology (with install source)
- `Standard.md` - Diataxis framework documentation

### 3.4 Copy Workflow Files

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

### After Fresh Install

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

### After Update

```
"PAI Diataxis Documentation Skill updated to v1.0.0!

What changed:
- [List key changes from changelog]

Your existing project configs (docs/.diataxis.md) were preserved.
No action needed - the skill is ready to use."
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
