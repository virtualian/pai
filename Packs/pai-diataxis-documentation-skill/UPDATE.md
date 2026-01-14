# PAI Diataxis Documentation Skill - Update Guide

**This guide is designed for AI agents updating an installed skill.**

**Triggers:**
- User asks to update: "update diataxis skill", "check for skill updates"
- Skill use (background check): runs silently, notifies if update available
- Explicit version check: "what version is diataxis skill"

---

## AI Agent Instructions

**UPDATE.md is for updating an already-installed skill.** For fresh installations, use INSTALL.md.

### Key Principles

1. **Graceful Degradation** - If update sources are unavailable, the skill continues working
2. **Source Preference** - User chooses between their install source and canonical source
3. **Settings Preservation** - Project configs (`docs/.diataxis.md`) are never touched
4. **Metadata Preservation** - `install_source` is preserved; only `last_updated_from` changes
5. **Deprecation Handling** - Old files are removed, user is notified

---

## Phase 1: Version Detection

**This phase can run standalone (background check) or as part of explicit update request.**

### 1.1 Read Installed Metadata

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_DIR="$PAI_DIR/skills/Diataxis-Documentation"
SKILL_FILE="$SKILL_DIR/SKILL.md"

# Check if skill is installed
if [ ! -f "$SKILL_FILE" ]; then
  echo "❌ Skill not installed. Use INSTALL.md for fresh installation."
  exit 1
fi

# Read installed metadata
INSTALLED_VERSION=$(grep -E "^version:" "$SKILL_FILE" | cut -d' ' -f2)
INSTALL_SOURCE=$(grep -E "^install_source:" "$SKILL_FILE" | sed 's/^install_source: //')
LAST_UPDATED_FROM=$(grep -E "^last_updated_from:" "$SKILL_FILE" | sed 's/^last_updated_from: //')
OFFICIAL_SOURCE=$(grep -E "^official_source:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL_PATH=$(grep -E "^official_source_path:" "$SKILL_FILE" | cut -d' ' -f2)

# Defaults for official source
OFFICIAL_SOURCE="${OFFICIAL_SOURCE:-https://github.com/danielmiessler/Personal_AI_Infrastructure}"
OFFICIAL_PATH="${OFFICIAL_PATH:-Packs/pai-diataxis-documentation-skill}"

echo "=== Installed Skill ==="
echo "Version: $INSTALLED_VERSION"
echo "Install source: $INSTALL_SOURCE"
echo "Last updated from: $LAST_UPDATED_FROM"
echo "Official source: $OFFICIAL_SOURCE"
```

### 1.2 Check Local Source (last_updated_from)

```bash
# Extract local path from last_updated_from (may include git remote info)
LOCAL_PATH=$(echo "$LAST_UPDATED_FROM" | sed 's/ (from .*//')

LOCAL_VERSION="unavailable"
LOCAL_AVAILABLE="false"

if [ -d "$LOCAL_PATH" ] && [ -f "$LOCAL_PATH/src/skills/Diataxis-Documentation/SKILL.md" ]; then
  LOCAL_VERSION=$(grep -E "^version:" "$LOCAL_PATH/src/skills/Diataxis-Documentation/SKILL.md" | cut -d' ' -f2)
  LOCAL_AVAILABLE="true"
  echo ""
  echo "=== Local Source ==="
  echo "Path: $LOCAL_PATH"
  echo "Version: $LOCAL_VERSION"
  echo "Status: Available"
else
  echo ""
  echo "=== Local Source ==="
  echo "Path: $LOCAL_PATH"
  echo "Status: Not available (path doesn't exist or skill not found)"
fi
```

### 1.3 Check Canonical Source (GitHub)

```bash
# Build GitHub raw URL
RAW_URL=$(echo "$OFFICIAL_SOURCE" | sed 's|github.com|raw.githubusercontent.com|')
REMOTE_SKILL="$RAW_URL/main/$OFFICIAL_PATH/src/skills/Diataxis-Documentation/SKILL.md"

CANONICAL_VERSION=$(curl -s --connect-timeout 5 "$REMOTE_SKILL" 2>/dev/null | grep -E "^version:" | head -1 | cut -d' ' -f2)
CANONICAL_AVAILABLE="false"

if [ -n "$CANONICAL_VERSION" ] && [ "$CANONICAL_VERSION" != "" ]; then
  CANONICAL_AVAILABLE="true"
  echo ""
  echo "=== Canonical Source (Official) ==="
  echo "URL: $OFFICIAL_SOURCE"
  echo "Version: $CANONICAL_VERSION"
  echo "Status: Available"
else
  CANONICAL_VERSION="unavailable"
  echo ""
  echo "=== Canonical Source (Official) ==="
  echo "URL: $OFFICIAL_SOURCE"
  echo "Status: Not available (network error or repo not found)"
fi
```

### 1.4 Version Comparison

```bash
echo ""
echo "=== Version Summary ==="
echo "┌─────────────────┬─────────────┬───────────┐"
echo "│ Source          │ Version     │ Status    │"
echo "├─────────────────┼─────────────┼───────────┤"
printf "│ Installed       │ %-11s │ current   │\n" "$INSTALLED_VERSION"

# Compare local
if [ "$LOCAL_AVAILABLE" = "true" ]; then
  if [ "$LOCAL_VERSION" = "$INSTALLED_VERSION" ]; then
    LOCAL_STATUS="same"
  elif [ "$LOCAL_VERSION" \> "$INSTALLED_VERSION" ]; then
    LOCAL_STATUS="NEWER"
  else
    LOCAL_STATUS="older"
  fi
  printf "│ Local           │ %-11s │ %-9s │\n" "$LOCAL_VERSION" "$LOCAL_STATUS"
else
  printf "│ Local           │ %-11s │ %-9s │\n" "n/a" "offline"
fi

# Compare canonical
if [ "$CANONICAL_AVAILABLE" = "true" ]; then
  if [ "$CANONICAL_VERSION" = "$INSTALLED_VERSION" ]; then
    CANONICAL_STATUS="same"
  elif [ "$CANONICAL_VERSION" \> "$INSTALLED_VERSION" ]; then
    CANONICAL_STATUS="NEWER"
  else
    CANONICAL_STATUS="older"
  fi
  printf "│ Canonical       │ %-11s │ %-9s │\n" "$CANONICAL_VERSION" "$CANONICAL_STATUS"
else
  printf "│ Canonical       │ %-11s │ %-9s │\n" "n/a" "offline"
fi

echo "└─────────────────┴─────────────┴───────────┘"

# Determine if update is available
UPDATE_AVAILABLE="false"
if [ "$LOCAL_STATUS" = "NEWER" ] || [ "$CANONICAL_STATUS" = "NEWER" ]; then
  UPDATE_AVAILABLE="true"
  echo ""
  echo "⬆️  UPDATE AVAILABLE"
fi
```

---

## Phase 2: User Choice

**Skip this phase if running as background check during skill use.** For background checks, just notify and continue.

### 2.1 Background Check Mode (Skill Use)

If this check is triggered by skill use (not explicit update request):

```
"ℹ️ Update available for Diataxis skill: $INSTALLED_VERSION → $NEWER_VERSION

To update, say 'update diataxis skill' when ready.

Continuing with current version..."
```

**Then proceed with the skill's normal operation.** Do not interrupt workflow.

### 2.2 Explicit Update Request

If user explicitly requested update:

#### No Updates Available

```
"✓ Diataxis Documentation skill is up to date (v$INSTALLED_VERSION).

Sources checked:
- Local: $LOCAL_PATH ($LOCAL_STATUS)
- Canonical: $OFFICIAL_SOURCE ($CANONICAL_STATUS)

No action needed."
```

#### Updates Available - Single Source

If only one source has a newer version:

```json
{
  "header": "Update",
  "question": "Update available: $INSTALLED_VERSION → $NEWER_VERSION from $SOURCE_NAME. Proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Update now (Recommended)", "description": "Downloads and installs the update. Project configs preserved."},
    {"label": "Skip", "description": "Keep current version"}
  ]
}
```

#### Updates Available - Multiple Sources

If both local and canonical have newer versions:

```json
{
  "header": "Update Source",
  "question": "Updates available from multiple sources. Which should I use?",
  "multiSelect": false,
  "options": [
    {"label": "Local ($LOCAL_VERSION)", "description": "Update from $LOCAL_PATH - your development copy"},
    {"label": "Canonical ($CANONICAL_VERSION) (Recommended)", "description": "Update from official repository - latest stable"},
    {"label": "Skip update", "description": "Keep current version ($INSTALLED_VERSION)"}
  ]
}
```

**Recommendation Logic:**
- If canonical is newer than local: recommend canonical
- If local is newer than canonical: recommend local (user has unreleased changes)
- If same version: recommend canonical (official source)

---

## Phase 3: Update Execution

### 3.1 Create Backup

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_DIR="$PAI_DIR/skills/Diataxis-Documentation"
BACKUP_DIR="$PAI_DIR/Backups/diataxis-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
cp -r "$SKILL_DIR" "$BACKUP_DIR/"
echo "✓ Backup created: $BACKUP_DIR"
```

### 3.2 Capture Current Metadata (Before Update)

```bash
# Preserve install_source - this should NEVER change after initial install
ORIGINAL_INSTALL_SOURCE=$(grep -E "^install_source:" "$SKILL_DIR/SKILL.md" | sed 's/^install_source: //')
echo "Preserving install_source: $ORIGINAL_INSTALL_SOURCE"
```

### 3.3 List Current Files (For Deprecation Detection)

```bash
# Get list of current files
CURRENT_FILES=$(find "$SKILL_DIR" -type f -name "*.md" | sort)
echo "Current files:"
echo "$CURRENT_FILES"
```

### 3.4a Update from Local Source

If user chose local source:

```bash
LOCAL_PATH="$CHOSEN_LOCAL_PATH"  # Set from Phase 2
SOURCE_DIR="$LOCAL_PATH/src/skills/Diataxis-Documentation"

# Copy skill files
cp "$SOURCE_DIR/SKILL.md" "$SKILL_DIR/"
cp "$SOURCE_DIR/Standard.md" "$SKILL_DIR/"
cp "$SOURCE_DIR/Workflows/"*.md "$SKILL_DIR/Workflows/"

echo "✓ Files copied from local source"

# Build update source string
UPDATE_SOURCE="$LOCAL_PATH"
if [ -d "$LOCAL_PATH/.git" ]; then
  GIT_REMOTE=$(cd "$LOCAL_PATH" && git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$GIT_REMOTE" ]; then
    GIT_REMOTE=$(echo "$GIT_REMOTE" | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
    UPDATE_SOURCE="$LOCAL_PATH (from $GIT_REMOTE)"
  fi
fi
```

### 3.4b Update from Canonical Source (GitHub)

If user chose canonical source:

```bash
RAW_URL=$(echo "$OFFICIAL_SOURCE" | sed 's|github.com|raw.githubusercontent.com|')
BASE_URL="$RAW_URL/main/$OFFICIAL_PATH/src/skills/Diataxis-Documentation"

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Downloading from canonical source..."

# Download each file
curl -s "$BASE_URL/SKILL.md" -o "$TEMP_DIR/SKILL.md"
curl -s "$BASE_URL/Standard.md" -o "$TEMP_DIR/Standard.md"

mkdir -p "$TEMP_DIR/Workflows"
curl -s "$BASE_URL/Workflows/InitializeProject.md" -o "$TEMP_DIR/Workflows/InitializeProject.md"
curl -s "$BASE_URL/Workflows/PlanDocumentation.md" -o "$TEMP_DIR/Workflows/PlanDocumentation.md"
curl -s "$BASE_URL/Workflows/OrganizeDocumentation.md" -o "$TEMP_DIR/Workflows/OrganizeDocumentation.md"
curl -s "$BASE_URL/Workflows/CreateScaffold.md" -o "$TEMP_DIR/Workflows/CreateScaffold.md"
curl -s "$BASE_URL/Workflows/GenerateContent.md" -o "$TEMP_DIR/Workflows/GenerateContent.md"
curl -s "$BASE_URL/Workflows/UpdateSkill.md" -o "$TEMP_DIR/Workflows/UpdateSkill.md"

# Verify downloads (check for valid content)
if ! grep -q "^name: Diataxis-Documentation" "$TEMP_DIR/SKILL.md"; then
  echo "❌ Download failed - SKILL.md invalid"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Copy to skill directory
cp "$TEMP_DIR/SKILL.md" "$SKILL_DIR/"
cp "$TEMP_DIR/Standard.md" "$SKILL_DIR/"
cp "$TEMP_DIR/Workflows/"*.md "$SKILL_DIR/Workflows/"

rm -rf "$TEMP_DIR"
echo "✓ Files downloaded from canonical source"

UPDATE_SOURCE="$OFFICIAL_SOURCE (canonical)"
```

### 3.5 Update Metadata

```bash
SKILL_FILE="$SKILL_DIR/SKILL.md"

# Escape special sed characters
escape_sed() { echo "$1" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g' -e 's/|/\\|/g'; }
ESCAPED_ORIGINAL=$(escape_sed "$ORIGINAL_INSTALL_SOURCE")
ESCAPED_UPDATE=$(escape_sed "$UPDATE_SOURCE")

# Update metadata: preserve install_source, update last_updated_from
sed -i.bak \
  -e "s|^install_source:.*|install_source: $ESCAPED_ORIGINAL|" \
  -e "s|^last_updated_from:.*|last_updated_from: $ESCAPED_UPDATE|" \
  "$SKILL_FILE"

rm -f "$SKILL_FILE.bak"

echo "✓ Metadata updated"
echo "  install_source: $ORIGINAL_INSTALL_SOURCE (preserved)"
echo "  last_updated_from: $UPDATE_SOURCE"
```

### 3.6 Handle Deprecations

```bash
# Get list of new files
NEW_FILES=$(find "$SKILL_DIR" -type f -name "*.md" | sort)

# Find files that exist in current but not in new (deprecated)
DEPRECATED_FILES=""
for file in $CURRENT_FILES; do
  filename=$(basename "$file")
  if ! echo "$NEW_FILES" | grep -q "$filename"; then
    DEPRECATED_FILES="$DEPRECATED_FILES $file"
  fi
done

if [ -n "$DEPRECATED_FILES" ]; then
  echo ""
  echo "=== Deprecated Files Detected ==="
  echo "The following files are no longer part of the skill:"
  for file in $DEPRECATED_FILES; do
    echo "  - $file"
  done

  # Move deprecated files to backup (don't delete outright)
  for file in $DEPRECATED_FILES; do
    filename=$(basename "$file")
    mv "$file" "$BACKUP_DIR/DEPRECATED_$filename"
    echo "  Moved to backup: DEPRECATED_$filename"
  done
  echo "✓ Deprecated files moved to backup"
else
  echo "✓ No deprecated files"
fi
```

---

## Phase 4: Post-Update

### 4.1 Verify Installation

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_DIR="$PAI_DIR/skills/Diataxis-Documentation"

echo "=== Verification ==="

# Check core files
[ -f "$SKILL_DIR/SKILL.md" ] && echo "✓ SKILL.md" || echo "❌ SKILL.md missing"
[ -f "$SKILL_DIR/Standard.md" ] && echo "✓ Standard.md" || echo "❌ Standard.md missing"

# Check workflows
[ -f "$SKILL_DIR/Workflows/InitializeProject.md" ] && echo "✓ InitializeProject.md" || echo "❌ InitializeProject.md missing"
[ -f "$SKILL_DIR/Workflows/PlanDocumentation.md" ] && echo "✓ PlanDocumentation.md" || echo "❌ PlanDocumentation.md missing"
[ -f "$SKILL_DIR/Workflows/OrganizeDocumentation.md" ] && echo "✓ OrganizeDocumentation.md" || echo "❌ OrganizeDocumentation.md missing"
[ -f "$SKILL_DIR/Workflows/CreateScaffold.md" ] && echo "✓ CreateScaffold.md" || echo "❌ CreateScaffold.md missing"
[ -f "$SKILL_DIR/Workflows/GenerateContent.md" ] && echo "✓ GenerateContent.md" || echo "❌ GenerateContent.md missing"

# Verify version updated
NEW_VERSION=$(grep -E "^version:" "$SKILL_DIR/SKILL.md" | cut -d' ' -f2)
echo ""
echo "Installed version: $NEW_VERSION"
```

### 4.2 Success Message

```
"✓ Diataxis Documentation skill updated to v$NEW_VERSION!

Updated from: $UPDATE_SOURCE
Backup saved: $BACKUP_DIR

Your project configs (docs/.diataxis.md) were preserved - no changes needed.

What's new in this version:
- [AI should summarize key changes if changelog available]

Would you like to use the updated skill now?"
```

### 4.3 Offer to Run Updated Skill

```json
{
  "header": "Next Step",
  "question": "Skill updated successfully. What would you like to do?",
  "multiSelect": false,
  "options": [
    {"label": "Use the skill now", "description": "Start a documentation task with the updated skill"},
    {"label": "View what changed", "description": "Show differences between old and new versions"},
    {"label": "Done", "description": "Return to normal operation"}
  ]
}
```

If user chooses "Use the skill now":
- Route to the Diataxis-Documentation skill
- The skill will check for `docs/.diataxis.md` and proceed normally

If user chooses "View what changed":
```bash
# Show diff between backup and current
diff -r "$BACKUP_DIR/Diataxis-Documentation" "$SKILL_DIR" --exclude="*.bak" 2>/dev/null || echo "No structural changes"
```

---

## Integration: Background Check on Skill Use

**Add this check to the skill's entry point (SKILL.md or workflows).**

When the Diataxis skill is invoked, optionally run a quick background check:

```bash
# Quick version check (timeout after 2 seconds to not block)
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_FILE="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"

INSTALLED_VERSION=$(grep -E "^version:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL_SOURCE=$(grep -E "^official_source:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL_PATH=$(grep -E "^official_source_path:" "$SKILL_FILE" | cut -d' ' -f2)

RAW_URL=$(echo "${OFFICIAL_SOURCE:-https://github.com/danielmiessler/Personal_AI_Infrastructure}" | sed 's|github.com|raw.githubusercontent.com|')
REMOTE_SKILL="$RAW_URL/main/${OFFICIAL_PATH:-Packs/pai-diataxis-documentation-skill}/src/skills/Diataxis-Documentation/SKILL.md"

# Quick fetch with timeout
LATEST=$(curl -s --connect-timeout 2 --max-time 3 "$REMOTE_SKILL" 2>/dev/null | grep -E "^version:" | head -1 | cut -d' ' -f2)

if [ -n "$LATEST" ] && [ "$LATEST" != "$INSTALLED_VERSION" ]; then
  echo "ℹ️ Update available: $INSTALLED_VERSION → $LATEST (say 'update diataxis skill' to update)"
fi
```

**Important:** This check should:
- Have a short timeout (2-3 seconds max)
- Not block skill operation if network is unavailable
- Only notify, never auto-update

---

## Rollback

If update causes issues:

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
BACKUP_DIR="$1"  # User provides backup path

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR/Diataxis-Documentation" ]; then
  echo "Usage: Provide backup directory path"
  echo "Available backups:"
  ls -la "$PAI_DIR/Backups/" | grep diataxis
  exit 1
fi

# Restore from backup
rm -rf "$PAI_DIR/skills/Diataxis-Documentation"
cp -r "$BACKUP_DIR/Diataxis-Documentation" "$PAI_DIR/skills/"

echo "✓ Rolled back to backup: $BACKUP_DIR"
```

---

## Troubleshooting

### "Skill not installed"

Use INSTALL.md for fresh installation, not UPDATE.md.

### "Both sources unavailable"

- Check network connection for canonical source
- Verify local path exists: `ls -la $LOCAL_PATH`
- The skill will continue working with current version

### "Download failed"

- GitHub may be temporarily unavailable
- Try again later or use local source if available

### "Deprecated files warning"

This is normal - old files are moved to backup, not deleted. If you need them, check the backup directory.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| "update diataxis skill" | Explicit update request |
| "check diataxis version" | Version check only |
| "rollback diataxis skill" | Restore from backup |

| File | Purpose |
|------|---------|
| `UPDATE.md` | This guide - updating installed skills |
| `INSTALL.md` | Fresh installation |
| `VERIFY.md` | Post-install verification |
