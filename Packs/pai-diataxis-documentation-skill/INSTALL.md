# PAI Diataxis Documentation Skill - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a simple file-copy installation.** The skill installs once globally; per-project configuration happens on first use.

### Get Pack Version

```bash
PACK_DIR="$(pwd)"
PACK_VERSION=$(grep -E "^version:" "$PACK_DIR/src/skills/Diataxis-Documentation/SKILL.md" | cut -d' ' -f2)
echo "Pack version: $PACK_VERSION"
```

### Welcome Message

```
"I'm installing PAI Diataxis Documentation Skill v$PACK_VERSION - a documentation methodology based on the Diataxis framework.

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
  INSTALLED_VERSION=$(grep -E "^version:" "$PAI_CHECK/skills/Diataxis-Documentation/SKILL.md" 2>/dev/null | cut -d' ' -f2 || echo "unknown")
  echo "Installed version: $INSTALLED_VERSION"
else
  INSTALLED_VERSION="none"
  echo "✓ No existing Diataxis-Documentation skill (clean install)"
fi

# Pack version (what we're installing from)
echo "Pack version: $PACK_VERSION"

# Check official remote for latest version
OFFICIAL_SOURCE="https://github.com/danielmiessler/Personal_AI_Infrastructure"
OFFICIAL_PATH="Packs/pai-diataxis-documentation-skill"
RAW_URL="https://raw.githubusercontent.com/danielmiessler/Personal_AI_Infrastructure"
REMOTE_SKILL="$RAW_URL/main/$OFFICIAL_PATH/src/skills/Diataxis-Documentation/SKILL.md"

LATEST_VERSION=$(curl -s "$REMOTE_SKILL" 2>/dev/null | grep -E "^version:" | head -1 | cut -d' ' -f2 || echo "unknown")
echo "Latest (official): $LATEST_VERSION"

# Compare versions
if [ "$INSTALLED_VERSION" != "none" ]; then
  if [ "$INSTALLED_VERSION" = "$PACK_VERSION" ]; then
    echo "✓ Pack matches installed"
  else
    echo "↑ Pack update: $INSTALLED_VERSION → $PACK_VERSION"
  fi
fi

if [ "$LATEST_VERSION" != "unknown" ] && [ "$PACK_VERSION" != "$LATEST_VERSION" ]; then
  echo ""
  echo "⚠️  NOTE: Official repo has newer version ($LATEST_VERSION)"
  echo "   Consider pulling latest from: $OFFICIAL_SOURCE"
fi
```

### 1.2 Present Findings

```
"Here's what I found:
- pai-core-install: [installed / NOT INSTALLED - REQUIRED]
- Installed version: [X.X.X / none]
- Pack version: [X.X.X]
- Latest (official): [X.X.X / unknown]
- Status: [Up to date / Update available / Official has newer]"
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
    {"content": "Capture existing install source", "status": "pending", "activeForm": "Capturing existing install source"},
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating directory structure"},
    {"content": "Copy skill files from pack", "status": "pending", "activeForm": "Copying skill files"},
    {"content": "Record install/update source", "status": "pending", "activeForm": "Recording install source"},
    {"content": "Copy workflow files", "status": "pending", "activeForm": "Copying workflow files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 3.1 Capture Existing Install Source (Before Copy)

**IMPORTANT: Must run before copying files to preserve original install source.**

**NOTE:** All Phase 3 commands (3.1 through 3.4) MUST run in the same shell session to preserve the `ORIGINAL_INSTALL_SOURCE` variable. Alternatively, save to a temp file as shown below.

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
EXISTING_SKILL="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"
# Use deterministic path (not $$) so state persists across shell sessions
INSTALL_STATE_FILE="$PAI_DIR/tmp/pai-diataxis-install-state.tmp"
mkdir -p "$PAI_DIR/tmp"

# Capture existing install_source before we overwrite it
if [ -f "$EXISTING_SKILL" ]; then
  ORIGINAL_INSTALL_SOURCE=$(grep -E "^install_source:" "$EXISTING_SKILL" | sed 's/^install_source: //')
  # Only keep it if it's not a placeholder
  if [ "$ORIGINAL_INSTALL_SOURCE" = "__INSTALL_SOURCE__" ]; then
    ORIGINAL_INSTALL_SOURCE=""
  fi
  echo "Existing install source: ${ORIGINAL_INSTALL_SOURCE:-none}"
else
  ORIGINAL_INSTALL_SOURCE=""
  echo "Fresh install (no existing skill)"
fi

# Save to temp file for later phases (in case shell session changes)
echo "ORIGINAL_INSTALL_SOURCE='$ORIGINAL_INSTALL_SOURCE'" > "$INSTALL_STATE_FILE"
echo "State saved to $INSTALL_STATE_FILE"
```

### 3.2 Create Directory Structure

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
mkdir -p "$PAI_DIR/skills/Diataxis-Documentation/Workflows"
```

### 3.3 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

cp "$PACK_DIR/src/skills/Diataxis-Documentation/SKILL.md" "$PAI_DIR/skills/Diataxis-Documentation/"
cp "$PACK_DIR/src/skills/Diataxis-Documentation/Standard.md" "$PAI_DIR/skills/Diataxis-Documentation/"
```

### 3.4 Record Install/Update Source

**Track original install location and last update location separately.**

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_FILE="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"
PACK_DIR="$(pwd)"

# Build current source string (local path + git remote if available)
CURRENT_SOURCE="$PACK_DIR"
if [ -d ".git" ]; then
  GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$GIT_REMOTE" ]; then
    GIT_REMOTE=$(echo "$GIT_REMOTE" | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
    CURRENT_SOURCE="$PACK_DIR (from $GIT_REMOTE)"
  fi
fi

# ORIGINAL_INSTALL_SOURCE was captured in step 3.1 before files were copied
# Restore from temp file if variable is not set (separate shell session)
INSTALL_STATE_FILE="$PAI_DIR/tmp/pai-diataxis-install-state.tmp"
if [ -z "$ORIGINAL_INSTALL_SOURCE" ] && [ -f "$INSTALL_STATE_FILE" ]; then
  source "$INSTALL_STATE_FILE"
  echo "Restored state from $INSTALL_STATE_FILE"
fi
# Clean up temp file after use
rm -f "$INSTALL_STATE_FILE" 2>/dev/null

# Escape special sed characters in replacement strings (& \ | need escaping)
escape_sed() { echo "$1" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g' -e 's/|/\\|/g'; }
ESCAPED_CURRENT=$(escape_sed "$CURRENT_SOURCE")
ESCAPED_ORIGINAL=$(escape_sed "$ORIGINAL_INSTALL_SOURCE")

if [ -z "$ORIGINAL_INSTALL_SOURCE" ]; then
  # Fresh install: set both to current source
  echo "Fresh install - recording install source"
  # Single sed command preserves true original in .bak file
  sed -i.bak \
    -e "s|^install_source:.*|install_source: $ESCAPED_CURRENT|" \
    -e "s|^last_updated_from:.*|last_updated_from: $ESCAPED_CURRENT|" \
    "$SKILL_FILE"
  echo "Install source: $CURRENT_SOURCE"
else
  # Update: preserve original, update last_updated_from
  echo "Update - preserving original install source"
  # Single sed command preserves true original in .bak file
  sed -i.bak \
    -e "s|^install_source:.*|install_source: $ESCAPED_ORIGINAL|" \
    -e "s|^last_updated_from:.*|last_updated_from: $ESCAPED_CURRENT|" \
    "$SKILL_FILE"
  echo "Original install: $ORIGINAL_INSTALL_SOURCE"
  echo "Updated from: $CURRENT_SOURCE"
fi

rm -f "$SKILL_FILE.bak"
echo "Official source (for updates): https://github.com/danielmiessler/Personal_AI_Infrastructure"
```

**Files copied:**
- `SKILL.md` - Main skill routing and Diataxis methodology (with install source)
- `Standard.md` - Diataxis framework documentation

### 3.5 Copy Workflow Files

```bash
PACK_DIR="$(pwd)"
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

cp "$PACK_DIR/src/skills/Diataxis-Documentation/Workflows/"*.md "$PAI_DIR/skills/Diataxis-Documentation/Workflows/"
```

**Workflows copied:**
- `InitializeProject.md` - First-use project configuration (creates docs site)
- `PlanDocumentation.md` - Documentation planning and gap analysis
- `OrganizeDocumentation.md` - Restructuring existing documentation
- `CreateScaffold.md` - Create documentation structure
- `GenerateContent.md` - Fill scaffold with content

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
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/CreateScaffold.md" ] && echo "✓ CreateScaffold.md" || echo "❌ CreateScaffold.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/GenerateContent.md" ] && echo "✓ GenerateContent.md" || echo "❌ GenerateContent.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/UpdateSkill.md" ] && echo "✓ UpdateSkill.md" || echo "❌ UpdateSkill.md missing"

echo "=== Verification Complete ==="
```

---

## Success Message

### After Fresh Install

```
"PAI Diataxis Documentation Skill v$PACK_VERSION installed successfully!

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
"PAI Diataxis Documentation Skill updated to v$PACK_VERSION!

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
| `Workflows/CreateScaffold.md` | Create documentation structure |
| `Workflows/GenerateContent.md` | Fill scaffold with content |

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
