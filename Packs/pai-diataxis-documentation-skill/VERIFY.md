# PAI Diataxis Documentation Skill - Verification Checklist

Run these checks after installation to verify everything is working.

---

## Quick Verification

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

echo "=== PAI Diataxis Documentation Skill Verification ==="
echo ""

# Check skill directory exists
echo "1. Checking skill directory..."
if [ -d "$PAI_DIR/skills/Diataxis-Documentation" ]; then
  echo "   ✓ Skill directory exists"
else
  echo "   ❌ Skill directory missing"
  exit 1
fi

# Check core skill files
echo ""
echo "2. Checking core files..."
[ -f "$PAI_DIR/skills/Diataxis-Documentation/SKILL.md" ] && echo "   ✓ SKILL.md" || echo "   ❌ SKILL.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Standard.md" ] && echo "   ✓ Standard.md" || echo "   ❌ Standard.md missing"

# Check workflow files
echo ""
echo "3. Checking workflows..."
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/InitializeProject.md" ] && echo "   ✓ InitializeProject.md" || echo "   ❌ InitializeProject.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/PlanDocumentation.md" ] && echo "   ✓ PlanDocumentation.md" || echo "   ❌ PlanDocumentation.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/OrganizeDocumentation.md" ] && echo "   ✓ OrganizeDocumentation.md" || echo "   ❌ OrganizeDocumentation.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/CreateScaffold.md" ] && echo "   ✓ CreateScaffold.md" || echo "   ❌ CreateScaffold.md missing"
[ -f "$PAI_DIR/skills/Diataxis-Documentation/Workflows/GenerateContent.md" ] && echo "   ✓ GenerateContent.md" || echo "   ❌ GenerateContent.md missing"

echo ""
echo "=== Verification Complete ==="
```

---

## Detailed Checks

### 1. Skill Directory Structure

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
tree "$PAI_DIR/skills/Diataxis-Documentation" 2>/dev/null || ls -laR "$PAI_DIR/skills/Diataxis-Documentation"
```

**Expected structure:**
```
Diataxis-Documentation/
├── SKILL.md
├── Standard.md
└── Workflows/
    ├── InitializeProject.md
    ├── PlanDocumentation.md
    ├── OrganizeDocumentation.md
    ├── CreateScaffold.md
    └── GenerateContent.md
```

### 2. SKILL.md Content Check

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
head -20 "$PAI_DIR/skills/Diataxis-Documentation/SKILL.md"
```

**Should contain:**
- YAML frontmatter with `name:` and `description:`
- Workflow routing table (including InitializeProject)
- Examples section

### 3. Workflow Files Content Check

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
for f in InitializeProject PlanDocumentation OrganizeDocumentation CreateScaffold GenerateContent UpdateSkill; do
  echo "--- $f.md ---"
  head -10 "$PAI_DIR/skills/Diataxis-Documentation/Workflows/$f.md"
  echo ""
done
```

---

## Functional Tests

### Test 1: Skill Recognition

Ask your AI:
```
"What Diataxis type should a 'Getting Started' guide be?"
```

**Expected:** Should invoke Diataxis-Documentation skill and respond with "Tutorial" (learning-oriented, practical).

### Test 2: Project Initialization Detection

In a project without `docs/.diataxis.md`, ask your AI:
```
"Plan documentation for this project"
```

**Expected:** Should detect no configuration exists and offer to run InitializeProject workflow first.

### Test 3: Workflow Invocation (after initialization)

In a project with `docs/.diataxis.md`, ask your AI:
```
"Plan documentation for this project"
```

**Expected:** Should read `docs/.diataxis.md` and invoke PlanDocumentation workflow.

---

## Troubleshooting

### Skill Not Found

If the skill isn't being invoked:

1. Check the skill directory exists:
   ```bash
   ls -la $PAI_DIR/skills/Diataxis-Documentation/
   ```

2. Verify SKILL.md has correct frontmatter:
   ```bash
   head -5 $PAI_DIR/skills/Diataxis-Documentation/SKILL.md
   ```

3. Restart your Claude Code session

### Workflows Not Working

If workflows aren't being triggered:

1. Check workflow files exist:
   ```bash
   ls -la $PAI_DIR/skills/Diataxis-Documentation/Workflows/
   ```

2. Verify SKILL.md workflow routing table references correct files

### Project Not Detecting Configuration

If the skill doesn't detect existing `docs/.diataxis.md`:

1. Check the file exists in the project:
   ```bash
   cat ./docs/.diataxis.md
   ```

2. Ensure you're in the correct working directory

---

## Success Criteria

All of the following should pass:

- [ ] Skill directory exists at `$PAI_DIR/skills/Diataxis-Documentation/`
- [ ] SKILL.md exists and has valid frontmatter
- [ ] Standard.md exists with Diataxis framework content
- [ ] All four workflow files exist in Workflows/
- [ ] Skill responds to documentation-related queries
- [ ] InitializeProject runs in unconfigured projects
- [ ] Other workflows read `docs/.diataxis.md` when it exists
