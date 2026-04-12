# Learning v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **Bash/Read/Write** - For actual installation
3. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing Learning v1.0.0 -- closed-loop behavioural improvement for Claude Code.

This pack adds the Learning skill with:
- 3 commands: /learn check, /learn review, /learn apply
- 5-stage pipeline: Mine, Synthesise, Propose, Review, Apply
- 3 change targets: Algorithm spec, AISTEERINGRULES.md, feedback memories

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for Claude Code skills directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if skills directory exists
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for existing Learning skill (standalone)
if [ -d "$CLAUDE_DIR/skills/Learning" ]; then
  echo "WARNING Existing Learning skill found at: $CLAUDE_DIR/skills/Learning"
  ls -la "$CLAUDE_DIR/skills/Learning/" 2>/dev/null
else
  echo "OK No existing standalone Learning skill (clean install)"
fi

# Check for legacy Learning sub-skill in Utilities
if [ -d "$CLAUDE_DIR/skills/Utilities/Learning" ]; then
  echo "INFO Legacy Learning sub-skill found in Utilities (will be superseded)"
  ls -la "$CLAUDE_DIR/skills/Utilities/Learning/" 2>/dev/null
else
  echo "OK No legacy Learning sub-skill in Utilities"
fi

# Check for MEMORY/LEARNING directory
if [ -d "$CLAUDE_DIR/MEMORY/LEARNING" ]; then
  echo "OK MEMORY/LEARNING directory exists (existing data preserved)"
else
  echo "INFO MEMORY/LEARNING not found (will be created by hooks as needed)"
fi

# Check for PAI Tools (Inference.ts needed by MineRatings.ts)
if [ -f "$CLAUDE_DIR/PAI/Tools/Inference.ts" ]; then
  echo "OK PAI Inference.ts found (needed by MineRatings tool)"
else
  echo "WARNING PAI Inference.ts not found (MineRatings tool will not work without it)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing Learning skill: [found -- will ask about conflict / not found]
- Legacy Utilities/Learning: [found -- will be superseded / not found]
- MEMORY/LEARNING: [found -- existing data preserved / not found]
- PAI Inference.ts: [found / not found -- needed by MineRatings tool]

[If legacy Utilities/Learning found]: Note: This pack replaces the Learning sub-skill
in Utilities. After installing, you should reinstall the Utilities pack without
the Learning sub-skill. The Utilities pack has already been updated to remove it."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing standalone Learning skill detected:**

```json
{
  "header": "Conflict -- Existing Learning Skill",
  "question": "An existing Learning skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install Learning v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.pai/skills/Learning/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Directories to be created:
- ~/.pai/skills/Learning/
- ~/.pai/skills/Learning/Workflows/ (3 workflow files)
- ~/.pai/skills/Learning/Tools/ (1 TypeScript tool)

Files to be created:
- ~/.pai/skills/Learning/SKILL.md (skill definition and routing)
- ~/.pai/skills/Learning/Workflows/Check.md (Mine + Synthesise)
- ~/.pai/skills/Learning/Workflows/Review.md (Propose + Review)
- ~/.pai/skills/Learning/Workflows/Apply.md (Two-gate Apply)
- ~/.pai/skills/Learning/Tools/MineRatings.ts (Behavioral analysis tool)

No other files will be modified. No hooks, no configuration changes.
Existing MEMORY/LEARNING/ data is preserved."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/learning-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$CLAUDE_DIR/skills/Learning" ]; then
  cp -R "$CLAUDE_DIR/skills/Learning" "$BACKUP_DIR/Learning"
  echo "Backed up Learning skill to: $BACKUP_DIR/Learning"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Learning"
mkdir -p "$CLAUDE_DIR/skills/Learning/Workflows"
mkdir -p "$CLAUDE_DIR/skills/Learning/Tools"
echo "Directory structure created"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy SKILL.md
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/Learning/SKILL.md"

# Copy all workflows
cp "$PACK_DIR/src/Workflows/"*.md "$CLAUDE_DIR/skills/Learning/Workflows/"

# Copy tools
cp "$PACK_DIR/src/Tools/"*.ts "$CLAUDE_DIR/skills/Learning/Tools/"

echo "All skill files copied"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"Learning v1.0.0 installed successfully!

What's available:
- /learn check -- Mine signals and synthesise patterns
- /learn review -- Generate proposals, open review file
- /learn apply -- Stage diffs, apply accepted changes
- /learn -- Show current pipeline status

The skill reads from MEMORY/LEARNING/ (ratings.jsonl, algorithm-reflections.jsonl)
and can write changes to Algorithm spec, AISTEERINGRULES.md, and feedback memories.

If you had Learning as a Utilities sub-skill, reinstall the Utilities pack
to remove the old copy."
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.pai/skills/
3. Run the verification commands in VERIFY.md"
```
