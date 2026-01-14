# UpdateSkill Workflow

**Purpose:** Check for updates and update the Diataxis Documentation skill.

**Triggers:**
- "update diataxis skill"
- "check for diataxis updates"
- "skill version"
- "is there an update"

**Reference:** See `UPDATE.md` in the pack root for detailed implementation.

---

## Mode Detection

Determine the workflow mode based on trigger:

| Trigger Pattern | Mode |
|-----------------|------|
| "update", "upgrade" | Full update flow |
| "version", "check" | Version check only |

---

## Phase 1: Version Detection

### 1.1 Read Installed Metadata

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_FILE="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"

if [ ! -f "$SKILL_FILE" ]; then
  echo "❌ Skill not installed"
  exit 1
fi

INSTALLED_VERSION=$(grep -E "^version:" "$SKILL_FILE" | cut -d' ' -f2)
INSTALL_SOURCE=$(grep -E "^install_source:" "$SKILL_FILE" | sed 's/^install_source: //')
LAST_UPDATED_FROM=$(grep -E "^last_updated_from:" "$SKILL_FILE" | sed 's/^last_updated_from: //')
OFFICIAL_SOURCE=$(grep -E "^official_source:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL_PATH=$(grep -E "^official_source_path:" "$SKILL_FILE" | cut -d' ' -f2)

OFFICIAL_SOURCE="${OFFICIAL_SOURCE:-https://github.com/danielmiessler/Personal_AI_Infrastructure}"
OFFICIAL_PATH="${OFFICIAL_PATH:-Packs/pai-diataxis-documentation-skill}"

echo "Installed: v$INSTALLED_VERSION"
echo "From: $INSTALL_SOURCE"
```

### 1.2 Check Available Sources

```bash
# Check local source
LOCAL_PATH=$(echo "$LAST_UPDATED_FROM" | sed 's/ (from .*//')
LOCAL_VERSION="n/a"
LOCAL_AVAILABLE="false"

if [ -d "$LOCAL_PATH" ] && [ -f "$LOCAL_PATH/src/skills/Diataxis-Documentation/SKILL.md" ]; then
  LOCAL_VERSION=$(grep -E "^version:" "$LOCAL_PATH/src/skills/Diataxis-Documentation/SKILL.md" | cut -d' ' -f2)
  LOCAL_AVAILABLE="true"
fi

# Check canonical source (GitHub)
RAW_URL=$(echo "$OFFICIAL_SOURCE" | sed 's|github.com|raw.githubusercontent.com|')
REMOTE_SKILL="$RAW_URL/main/$OFFICIAL_PATH/src/skills/Diataxis-Documentation/SKILL.md"
CANONICAL_VERSION=$(curl -s --connect-timeout 5 "$REMOTE_SKILL" 2>/dev/null | grep -E "^version:" | head -1 | cut -d' ' -f2)
CANONICAL_AVAILABLE="false"
[ -n "$CANONICAL_VERSION" ] && CANONICAL_AVAILABLE="true"
```

### 1.3 Display Version Summary

```bash
echo ""
echo "┌─────────────────┬─────────────┬───────────┐"
echo "│ Source          │ Version     │ Status    │"
echo "├─────────────────┼─────────────┼───────────┤"
printf "│ Installed       │ %-11s │ current   │\n" "$INSTALLED_VERSION"

if [ "$LOCAL_AVAILABLE" = "true" ]; then
  [[ "$LOCAL_VERSION" > "$INSTALLED_VERSION" ]] && LOCAL_STATUS="NEWER" || LOCAL_STATUS="same/older"
  printf "│ Local           │ %-11s │ %-9s │\n" "$LOCAL_VERSION" "$LOCAL_STATUS"
else
  printf "│ Local           │ %-11s │ %-9s │\n" "n/a" "offline"
fi

if [ "$CANONICAL_AVAILABLE" = "true" ]; then
  [[ "$CANONICAL_VERSION" > "$INSTALLED_VERSION" ]] && CANONICAL_STATUS="NEWER" || CANONICAL_STATUS="same/older"
  printf "│ Canonical       │ %-11s │ %-9s │\n" "$CANONICAL_VERSION" "$CANONICAL_STATUS"
else
  printf "│ Canonical       │ %-11s │ %-9s │\n" "n/a" "offline"
fi

echo "└─────────────────┴─────────────┴───────────┘"
```

---

## Phase 2: User Decision

### If Version Check Only

Present summary and stop:

```
"Diataxis Documentation skill v$INSTALLED_VERSION

Sources:
- Local ($LOCAL_PATH): $LOCAL_VERSION ($LOCAL_STATUS)
- Canonical ($OFFICIAL_SOURCE): $CANONICAL_VERSION ($CANONICAL_STATUS)

[Up to date / Update available from X]"
```

### If Update Requested - No Updates

```
"✓ Skill is up to date (v$INSTALLED_VERSION)

No newer versions found in:
- Local source: $LOCAL_PATH
- Canonical source: $OFFICIAL_SOURCE"
```

### If Update Requested - Single Source Has Update

```json
{
  "header": "Update",
  "question": "Update available: v$INSTALLED_VERSION → v$NEWER_VERSION. Proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Update now (Recommended)", "description": "Downloads update. Project configs preserved."},
    {"label": "Skip", "description": "Keep current version"}
  ]
}
```

### If Update Requested - Multiple Sources Have Updates

```json
{
  "header": "Update Source",
  "question": "Updates available from multiple sources. Which should I use?",
  "multiSelect": false,
  "options": [
    {"label": "Local (v$LOCAL_VERSION)", "description": "From $LOCAL_PATH"},
    {"label": "Canonical (v$CANONICAL_VERSION) (Recommended)", "description": "From official repository"},
    {"label": "Skip", "description": "Keep current version"}
  ]
}
```

**Recommendation:** Prefer canonical unless local is newer (unreleased changes).

---

## Phase 3: Execute Update

### 3.1 Backup

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_DIR="$PAI_DIR/skills/Diataxis-Documentation"
BACKUP_DIR="$PAI_DIR/Backups/diataxis-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
cp -r "$SKILL_DIR" "$BACKUP_DIR/"
echo "✓ Backup: $BACKUP_DIR"
```

### 3.2 Preserve Original Metadata

```bash
ORIGINAL_INSTALL_SOURCE=$(grep -E "^install_source:" "$SKILL_DIR/SKILL.md" | sed 's/^install_source: //')
```

### 3.3a Update from Local

```bash
SOURCE_DIR="$LOCAL_PATH/src/skills/Diataxis-Documentation"
cp "$SOURCE_DIR/SKILL.md" "$SKILL_DIR/"
cp "$SOURCE_DIR/Standard.md" "$SKILL_DIR/"
cp "$SOURCE_DIR/Workflows/"*.md "$SKILL_DIR/Workflows/"

UPDATE_SOURCE="$LOCAL_PATH"
[ -d "$LOCAL_PATH/.git" ] && {
  GIT_REMOTE=$(cd "$LOCAL_PATH" && git remote get-url origin 2>/dev/null | sed 's|git@github.com:|https://github.com/|;s|\.git$||')
  [ -n "$GIT_REMOTE" ] && UPDATE_SOURCE="$LOCAL_PATH (from $GIT_REMOTE)"
}
```

### 3.3b Update from Canonical

```bash
RAW_URL=$(echo "$OFFICIAL_SOURCE" | sed 's|github.com|raw.githubusercontent.com|')
BASE_URL="$RAW_URL/main/$OFFICIAL_PATH/src/skills/Diataxis-Documentation"

TEMP_DIR=$(mktemp -d)
curl -s "$BASE_URL/SKILL.md" -o "$TEMP_DIR/SKILL.md"
curl -s "$BASE_URL/Standard.md" -o "$TEMP_DIR/Standard.md"
mkdir -p "$TEMP_DIR/Workflows"
for wf in InitializeProject PlanDocumentation OrganizeDocumentation CreateScaffold GenerateContent UpdateSkill; do
  curl -s "$BASE_URL/Workflows/$wf.md" -o "$TEMP_DIR/Workflows/$wf.md"
done

# Verify
grep -q "^name: Diataxis-Documentation" "$TEMP_DIR/SKILL.md" || { echo "❌ Download failed"; rm -rf "$TEMP_DIR"; exit 1; }

cp "$TEMP_DIR/SKILL.md" "$SKILL_DIR/"
cp "$TEMP_DIR/Standard.md" "$SKILL_DIR/"
cp "$TEMP_DIR/Workflows/"*.md "$SKILL_DIR/Workflows/"
rm -rf "$TEMP_DIR"

UPDATE_SOURCE="$OFFICIAL_SOURCE (canonical)"
```

### 3.4 Update Metadata

```bash
escape_sed() { echo "$1" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g' -e 's/|/\\|/g'; }
ESCAPED_ORIGINAL=$(escape_sed "$ORIGINAL_INSTALL_SOURCE")
ESCAPED_UPDATE=$(escape_sed "$UPDATE_SOURCE")

sed -i.bak \
  -e "s|^install_source:.*|install_source: $ESCAPED_ORIGINAL|" \
  -e "s|^last_updated_from:.*|last_updated_from: $ESCAPED_UPDATE|" \
  "$SKILL_DIR/SKILL.md"
rm -f "$SKILL_DIR/SKILL.md.bak"
```

### 3.5 Handle Deprecations

```bash
# Compare file lists - backup has old, skill_dir has new
# Any files in backup but not in new = deprecated
OLD_FILES=$(find "$BACKUP_DIR/Diataxis-Documentation" -name "*.md" -type f | xargs -I{} basename {})
NEW_FILES=$(find "$SKILL_DIR" -name "*.md" -type f | xargs -I{} basename {})

for old in $OLD_FILES; do
  if ! echo "$NEW_FILES" | grep -q "^$old$"; then
    echo "Deprecated: $old (moved to backup)"
  fi
done
```

---

## Phase 4: Verification

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_DIR="$PAI_DIR/skills/Diataxis-Documentation"

echo "=== Verification ==="
[ -f "$SKILL_DIR/SKILL.md" ] && echo "✓ SKILL.md" || echo "❌ SKILL.md"
[ -f "$SKILL_DIR/Standard.md" ] && echo "✓ Standard.md" || echo "❌ Standard.md"
[ -f "$SKILL_DIR/Workflows/InitializeProject.md" ] && echo "✓ InitializeProject.md" || echo "❌ InitializeProject.md"
[ -f "$SKILL_DIR/Workflows/UpdateSkill.md" ] && echo "✓ UpdateSkill.md" || echo "❌ UpdateSkill.md"

NEW_VERSION=$(grep -E "^version:" "$SKILL_DIR/SKILL.md" | cut -d' ' -f2)
echo ""
echo "Updated to: v$NEW_VERSION"
```

---

## Phase 5: Post-Update

### Success Message

```
"✓ Diataxis Documentation skill updated to v$NEW_VERSION!

Updated from: $UPDATE_SOURCE
Backup saved: $BACKUP_DIR

Your project configs (docs/.diataxis.md) were preserved.

Would you like to use the skill now?"
```

### Next Step Options

```json
{
  "header": "Next",
  "question": "Update complete. What next?",
  "multiSelect": false,
  "options": [
    {"label": "Use the skill", "description": "Start a documentation task"},
    {"label": "View changes", "description": "Show diff between versions"},
    {"label": "Done", "description": "Return to normal operation"}
  ]
}
```

---

## Background Check (On Skill Use)

**Optional:** When any Diataxis workflow runs, perform a quick background check:

```bash
# Quick check with 2-second timeout - DO NOT BLOCK
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SKILL_FILE="$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"

INSTALLED=$(grep -E "^version:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL=$(grep -E "^official_source:" "$SKILL_FILE" | cut -d' ' -f2)
OFFICIAL="${OFFICIAL:-https://github.com/danielmiessler/Personal_AI_Infrastructure}"
PATH_=$(grep -E "^official_source_path:" "$SKILL_FILE" | cut -d' ' -f2)
PATH_="${PATH_:-Packs/pai-diataxis-documentation-skill}"

RAW=$(echo "$OFFICIAL" | sed 's|github.com|raw.githubusercontent.com|')
LATEST=$(curl -s --connect-timeout 2 --max-time 3 "$RAW/main/$PATH_/src/skills/Diataxis-Documentation/SKILL.md" 2>/dev/null | grep -E "^version:" | head -1 | cut -d' ' -f2)

[ -n "$LATEST" ] && [ "$LATEST" != "$INSTALLED" ] && echo "ℹ️ Update available: v$INSTALLED → v$LATEST (say 'update diataxis skill')"
```

**Rules:**
- Max 3 second timeout
- Never block workflow execution
- Notify only, never auto-update
- Fail silently if network unavailable

---

## Rollback

If update causes issues:

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
echo "Available backups:"
ls -la "$PAI_DIR/Backups/" | grep diataxis

# User provides backup path
BACKUP_PATH="$1"
rm -rf "$PAI_DIR/skills/Diataxis-Documentation"
cp -r "$BACKUP_PATH/Diataxis-Documentation" "$PAI_DIR/skills/"
echo "✓ Rolled back"
```
