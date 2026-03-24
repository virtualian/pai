# Learning Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check SKILL.md exists at target

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Learning/SKILL.md" ] && echo "OK Learning SKILL.md" || echo "MISSING Learning SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Learning/SKILL.md`.

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Directories:"
[ -d "$CLAUDE_DIR/skills/Learning/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -d "$CLAUDE_DIR/skills/Learning/Tools" ] && echo "  OK Tools/" || echo "  MISSING Tools/"
```

**Expected:** Both Workflows/ and Tools/ directories present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_FILE="$CLAUDE_DIR/skills/Learning/SKILL.md"

if [ -f "$SKILL_FILE" ]; then
  head -1 "$SKILL_FILE" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$SKILL_FILE" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$SKILL_FILE" && echo "OK SKILL.md has description" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** SKILL.md has valid YAML frontmatter with name and description fields.

### Check all workflow files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Workflows:"
for wf in Check.md Review.md Apply.md; do
  [ -f "$CLAUDE_DIR/skills/Learning/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done

WORKFLOW_COUNT=$(ls -1 "$CLAUDE_DIR/skills/Learning/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Total workflows: $WORKFLOW_COUNT (expected: 3)"
```

**Expected:** All 3 workflow files present.

### Check tool files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Tools:"
[ -f "$CLAUDE_DIR/skills/Learning/Tools/MineRatings.ts" ] && echo "  OK MineRatings.ts" || echo "  MISSING MineRatings.ts"
```

**Expected:** MineRatings.ts present.

### Check legacy Learning removed from Utilities

```bash
CLAUDE_DIR="$HOME/.claude"

if [ -d "$CLAUDE_DIR/skills/Utilities/Learning" ]; then
  echo "WARNING Legacy Learning sub-skill still exists in Utilities"
  echo "  Reinstall Utilities pack to remove it"
else
  echo "OK No legacy Learning sub-skill in Utilities"
fi
```

**Expected:** No Learning directory under Utilities skill.

---

## Installation Checklist

```markdown
## Learning Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/Learning/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Workflows/ directory contains Check.md, Review.md, Apply.md
- [ ] Tools/ directory contains MineRatings.ts

### Legacy Cleanup
- [ ] No Learning directory under ~/.claude/skills/Utilities/Learning/
- [ ] Utilities SKILL.md no longer routes to Learning workflows

### Functional (manual test)
- [ ] Saying "learn check" triggers Check workflow
- [ ] Saying "learn review" triggers Review workflow
- [ ] Saying "learn apply" triggers Apply workflow
- [ ] Bare "learn" shows pipeline status
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Learning skill installation verified successfully"
2. **Recommend:** "Try it now: say 'learn check' to mine and synthesize your learning signals"
3. **Note:** "If you had Learning as a Utilities sub-skill, reinstall the Utilities pack to clean up the old copy"
