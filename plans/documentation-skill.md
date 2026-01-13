# Plan: PAI Diataxis Documentation Skill Pack

## Goal

Create a formal PAI pack (`pai-diataxis-documentation-skill`) that provides Diataxis-based documentation methodology as an installable skill. The pack should be self-contained and contributable back to the PAI project.

## Approach

Build a complete pack in `Packs/pai-diataxis-documentation-skill/` following PAI pack conventions (v2.0 directory structure). User preferences and configuration happen during installation via the INSTALL.md wizard, not at runtime.

---

## Pack Structure

```
Packs/pai-diataxis-documentation-skill/
├── README.md                 # Pack overview, Diataxis explanation
├── INSTALL.md                # Wizard-style installation with user questions
├── VERIFY.md                 # Verification checklist
├── icons/
│   └── pai-diataxis-documentation-skill.png
└── src/
    └── skills/
        └── Diataxis-Documentation/
            ├── SKILL.md
            ├── Standard.md
            ├── Config.md           # User preferences (generated during install)
            └── Workflows/
                ├── PlanDocumentation.md
                ├── OrganizeDocumentation.md
                └── CreateDocumentation.md
```

---

## Installation-Time Configuration

The INSTALL.md wizard gathers user preferences upfront. These are stored in `Config.md` so the skill remembers decisions across sessions.

### Installation Questions (Phase 2)

**Q1: Documentation Roles**
> What roles/audiences does your documentation serve?
> Examples: users, developers, operators, contributors, API consumers

**Q2: Priority Diataxis Elements per Role**
> For each role, which Diataxis content types are most important?
> - Tutorials (learning-oriented)
> - How-to guides (task-oriented)  
> - Reference (information-oriented)
> - Explanation (understanding-oriented)

**Q3: Documentation Sources**
> What sources should inform your documentation?
> Examples: existing docs, code comments, specs, README files, external docs

**Q4: Source Priority**
> How should sources be prioritised when conflicts arise?

**Q5: Scope Exclusions**
> Confirm standard exclusions (README, LICENSE, etc.) or add custom exclusions

### Generated Config.md

Installation creates `Config.md` with user choices:

```markdown
# Diataxis Documentation Configuration

## Roles & Audiences
- developers: primary
- users: secondary
- operators: tertiary

## Diataxis Elements by Role
| Role | Tutorials | How-to | Reference | Explanation |
|------|-----------|--------|-----------|-------------|
| developers | ⬜ | ✅ | ✅ | ✅ |
| users | ✅ | ✅ | ⬜ | ✅ |
| operators | ⬜ | ✅ | ✅ | ⬜ |

## Documentation Sources
1. existing docs/ directory
2. code comments and docstrings
3. README.md (for context, not migration)

## Scope Exclusions
Standard repo files (outside Diataxis):
- README.md, LICENSE, CONTRIBUTING.md, CHANGELOG.md
- CODE_OF_CONDUCT.md, SECURITY.md, .github/*.md
- SKILL.md files (PAI skills)

Custom exclusions:
- (none configured)
```

---

## Skill Requirements

### Core Behaviors
- Provide succinct Diataxis imperatives (tutorials, how-to, reference, explanation)
- Encourage lookups of the Diataxis spec when uncertain
- Use role-first structure (who is this documentation for?)
- Read Config.md for user preferences on each invocation

### Runtime Behavior
- Recommend based on Config.md preferences
- Highlight deviations from agreed choices during implementation
- Flag inconsistencies during documentation updates
- Prompt for confirmation when diverging from established patterns

### Scope Rules

**Triggers (activates skill):**
- Creating/modifying/organizing documentation in `docs/`
- Setting up documentation sites (Docusaurus, etc.)
- Documentation planning and prioritisation
- Structuring guides, tutorials, reference docs

**Excluded from Diataxis scope:**
Standard repo files live at project root, outside Diataxis structure:
- `README.md` - project overview (not Diataxis)
- `LICENSE` / `LICENSE.md` - legal (not Diataxis)
- `CONTRIBUTING.md` - contribution guide (not Diataxis)
- `CHANGELOG.md` - version history (not Diataxis)
- `CODE_OF_CONDUCT.md` - community standards (not Diataxis)
- `SECURITY.md` - security policy (not Diataxis)
- `.github/*.md` - GitHub-specific templates (not Diataxis)

**Workflow should also identify:**
- Other markdown files that serve non-documentation purposes
- Config/metadata files that happen to be markdown
- Files that belong to external systems (e.g., SKILL.md files)
- Rule: if it serves a platform/tooling purpose, it's not Diataxis

---

## Files to Create

### 1. `src/skills/Diataxis-Documentation/SKILL.md`
Main skill file with:
- YAML frontmatter with USE WHEN triggers
- Workflow routing table
- Usage examples
- Core Diataxis imperatives (succinct summary)
- Reference to Config.md for user preferences

### 2. `src/skills/Diataxis-Documentation/Standard.md`
The Diataxis documentation standard:

**Core content:**
- Diataxis framework (tutorials, how-to, reference, explanation)
- Role-first structure principles
- Quality requirements
- Anti-patterns

**PAI adaptations:**
- TitleCase file naming for docs
- Skill documentation patterns (SKILL.md structure)
- Docusaurus conventions (when using website/ structure)
- Scope exclusion rules

### 3. `src/skills/Diataxis-Documentation/Config.md.template`
Template for user configuration (populated during installation).

### 4. `src/skills/Diataxis-Documentation/Workflows/PlanDocumentation.md`
Workflow for documentation planning:
- Read Config.md for user preferences
- Scan source for markdown files
- Classify files: Diataxis-scope vs excluded
- Recommend based on configured roles and priorities
- Present plan with rationale
- Confirm with user before proceeding

### 5. `src/skills/Diataxis-Documentation/Workflows/OrganizeDocumentation.md`
Workflow for restructuring existing docs:
- Read Config.md for scope exclusions
- Analyse current documentation structure
- Map to Diataxis categories based on role priorities
- Highlight deviations from configured patterns
- Propose migration plan with rationale

### 6. `src/skills/Diataxis-Documentation/Workflows/CreateDocumentation.md`
Workflow for writing new documentation:
- Read Config.md for role and element preferences
- Follow Diataxis content type rules
- Maintain role-first structure
- Track source provenance
- Flag deviations during writing

---

## Pack Metadata (README.md frontmatter)

```yaml
---
name: PAI Diataxis Documentation Skill
pack-id: pai-diataxis-documentation-skill-v1.0.0
version: 1.0.0
author: ianmarr
description: Diataxis-based documentation methodology skill - role-first structure, content type separation, installation-time configuration
type: skill
purpose-type: [productivity, development, documentation]
platform: claude-code
dependencies:
  - pai-core-install (required)
keywords: [documentation, diataxis, docs, tutorials, how-to, reference, explanation, methodology]
---
```

---

## Implementation Steps

1. Create pack directory structure in `Packs/pai-diataxis-documentation-skill/`
2. Create README.md with pack overview and Diataxis explanation
3. Create INSTALL.md with wizard-style questions (roles, elements, sources, exclusions)
4. Create VERIFY.md with verification checklist
5. Create `src/skills/Diataxis-Documentation/SKILL.md`
6. Create `src/skills/Diataxis-Documentation/Standard.md`
7. Create `src/skills/Diataxis-Documentation/Config.md.template`
8. Create `src/skills/Diataxis-Documentation/Workflows/PlanDocumentation.md`
9. Create `src/skills/Diataxis-Documentation/Workflows/OrganizeDocumentation.md`
10. Create `src/skills/Diataxis-Documentation/Workflows/CreateDocumentation.md`
11. Generate 256x256 pack icon
12. Test installation on fresh system

---

## Target Installation Paths

After installation, files live at:
- `$PAI_DIR/skills/Diataxis-Documentation/SKILL.md`
- `$PAI_DIR/skills/Diataxis-Documentation/Standard.md`
- `$PAI_DIR/skills/Diataxis-Documentation/Config.md`
- `$PAI_DIR/skills/Diataxis-Documentation/Workflows/*.md`
