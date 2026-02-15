---
name: Diataxis-Documentation
version: 2.5.0
install_source: __INSTALL_SOURCE__
last_updated_from: __LAST_UPDATED_FROM__
official_source: https://github.com/danielmiessler/Personal_AI_Infrastructure
official_source_path: Packs/pai-diataxis-documentation-skill
description: Diataxis-based documentation methodology. USE WHEN creating, modifying, or organizing documentation in docs/, setting up documentation sites, planning documentation, or structuring guides/tutorials/reference/explanation docs.
---

# Diataxis-Documentation - Documentation Methodology Skill

**Invoke when:** documentation planning, creating docs, organizing documentation, setting up Docusaurus/docs sites, writing tutorials, how-to guides, reference docs, or explanations.

## Overview

This skill provides Diataxis-based documentation methodology:
- **Four Content Types** - Tutorials, How-to Guides, Reference, Explanation
- **Role-First Structure** - Documentation organized by audience, then by content type
- **Site-Aware** - Purpose, hosting, and technology configuration
- **Source-Faithful** - Extract from sources, never hallucinate
- **Temporally Aware** - Past, present, and future capabilities distinguished
- **Per-Project Config** - Each project has its own `docs/.diataxis.md`
- **Workflow Automation** - Initialize, plan, organize, and create documentation

**First action on any documentation task:** Check for `docs/.diataxis.md` - if missing, run InitializeProject workflow.

## Core Principles

### 1. Source Fidelity (CRITICAL)

**Documentation MUST be derived from sources, never invented.**

- **Extract and Transform** - Take information from configured sources, restructure for Diataxis
- **No Hallucination** - If source doesn't cover something, flag as gap rather than inventing
- **Provenance Tracking** - Track which source informed which content
- **Cite Sources** - Use `<!-- Source: path/to/file:L10-L25 -->` comments

```markdown
<!-- Source: src/auth/oauth.ts:L45-L60 -->
OAuth 2.0 authentication requires a client ID and secret...
```

**When sources are incomplete:**
```markdown
> **Documentation Gap:** This section needs input on [topic].
> Source material does not cover [missing information].
```

### 2. Temporal Awareness

**Clearly distinguish past, present, and future capabilities.**

| Tag | When to Use |
|-----|-------------|
| `[CURRENT]` | Present capability (default, often implicit) |
| `[DEPRECATED]` | Being phased out, migration path needed |
| `[REMOVED]` | No longer available in current version |
| `[PLANNED]` | On roadmap, not yet shipped |
| `[EXPERIMENTAL]` | Available but unstable |

**Source temporal signals:**
- "will be", "planned", "coming soon" → `[PLANNED]`
- "deprecated", "legacy", "obsolete" → `[DEPRECATED]`
- "removed", "no longer supported" → `[REMOVED]` or omit
- "experimental", "beta", "unstable" → `[EXPERIMENTAL]`

### 3. Site Configuration

**`docs/.diataxis.md` defines site purpose, hosting, and technology:**
- **Purpose** - Developer Portal, Product Docs, Internal, Open Source
- **Hosting** - GitHub Pages, Vercel/Netlify, Self-hosted, Docs platform
- **Technology** - Docusaurus, MkDocs, Astro Starlight, Plain Markdown

Technology choice affects output format and conventions.

## Workflow Routing

**CRITICAL:** Before any workflow, check if project is initialized:
```bash
[ -f "./docs/.diataxis.md" ] && echo "configured" || echo "needs initialization"
```

| Workflow | Trigger | File |
|----------|---------|------|
| **InitializeProject** | First use in project, "set up docs", "initialize documentation", no `docs/.diataxis.md` | `Workflows/InitializeProject.md` |
| **PlanDocumentation** | "plan documentation", "documentation plan", "what docs do we need" | `Workflows/PlanDocumentation.md` |
| **OrganizeDocumentation** | "organize docs", "restructure documentation", "apply diataxis" | `Workflows/OrganizeDocumentation.md` |
| **CreateScaffold** | "create scaffold", "new doc scaffold" | `Workflows/CreateScaffold.md` |
| **GenerateContent** | "generate content", "fill scaffold", "create tutorial", "write how-to" | `Workflows/GenerateContent.md` |
| **UpdateSkill** | "update diataxis skill", "check for updates", "skill version" | `Workflows/UpdateSkill.md` |

## Quick Reference: Diataxis Content Types

| Type | Purpose | User Need | Example |
|------|---------|-----------|---------|
| **Tutorial** | Learning by doing | "I want to learn" | Getting Started guide |
| **How-to** | Solving a problem | "I want to accomplish X" | How to deploy to production |
| **Reference** | Looking up facts | "I need the details" | API documentation |
| **Explanation** | Understanding | "I want to understand why" | Architecture overview |

## Decision Tree: Which Content Type?

```
Is the user trying to LEARN something new?
├─ YES → Is it practical (hands-on)?
│        ├─ YES → TUTORIAL
│        └─ NO  → EXPLANATION
└─ NO  → Does the user have a specific GOAL?
         ├─ YES → HOW-TO GUIDE
         └─ NO  → REFERENCE
```

## Examples

**Example 1: Plan documentation**
```
User: "Plan documentation for this project"
→ Read docs/.diataxis.md for roles and priorities
→ Scan existing docs/
→ Map to Diataxis categories
→ Identify gaps based on role priorities
→ Present plan with rationale
```

**Example 2: Classify a doc**
```
User: "What type should our 'Getting Started' guide be?"
→ Learning-oriented + practical = TUTORIAL
→ Should guide user through first experience
→ Avoid explaining theory (link to explanation)
```

**Example 3: Create documentation**
```
User: "Create a how-to for deploying to AWS"
→ Read docs/.diataxis.md for role priorities
→ Follow How-to structure from Standard.md
→ Task-oriented: assume user knows basics
→ Numbered steps, clear success criteria
```

**Example 4: Organize existing docs**
```
User: "Organize my docs into Diataxis structure"
→ Read docs/.diataxis.md for scope exclusions
→ Analyze current docs/ structure
→ Classify each doc by content type
→ Propose new structure
→ Highlight mixed-content docs to split
```

## Scope Rules

### Triggers (activates this skill)

- Creating/modifying documentation in `docs/`
- Setting up documentation sites (Docusaurus, etc.)
- Documentation planning and prioritization
- Structuring guides, tutorials, reference docs
- Questions about documentation methodology

### Files Exempt from Diataxis Reorganization

These repo files serve platform/tooling purposes and should NOT be reorganized into Diataxis content type directories. **They may still be used as source material** when generating documentation content.

Common exempt files:
- `README.md` - Project overview
- `LICENSE` / `LICENSE.md` - Legal
- `CONTRIBUTING.md` - Contribution guide
- `CHANGELOG.md` - Version history
- `CODE_OF_CONDUCT.md` - Community standards
- `SECURITY.md` - Security policy
- `.github/*.md` - GitHub templates
- `SKILL.md` files - PAI skill definitions

**Rule:** If it serves a platform/tooling purpose, don't reorganize it into Diataxis structure — but DO use it as source material when relevant.

## Project Configuration Reference

**Each project has its own `docs/.diataxis.md` configuration file.** This is created by the InitializeProject workflow on first use.

Always read `docs/.diataxis.md` at the start of documentation tasks. It contains:

```markdown
## Site Configuration
- Purpose: Developer Portal | Product Docs | Internal | Open Source
- Hosting: GitHub Pages | Vercel/Netlify | Self-hosted | Docs platform
- Technology: Docusaurus | MkDocs | Astro Starlight | Plain Markdown

## Roles & Audiences
| Role | Priority |
|------|----------|
| developers | primary |
| users | secondary |

## Diataxis Elements by Role
| Role | Tutorials | How-to | Reference | Explanation |
|------|-----------|--------|-----------|-------------|
| developers | - | ✓ | ✓ | ✓ |

## Documentation Sources
1. existing docs/ directory
2. code comments

## Files Exempt from Diataxis Reorganization
- README.md, LICENSE (only files that exist in this project)
- Note: Exempt files may still be used as source material
```

**If `docs/.diataxis.md` doesn't exist:** Route to `Workflows/InitializeProject.md` first.

## Config Change Detection (CRITICAL)

**Every post-init workflow MUST validate configuration against filesystem before proceeding.**

When `docs/.diataxis.md` is modified after initialization, the filesystem may no longer match the config. Workflows detect this drift and require user confirmation before continuing.

### What Gets Checked

| Config Field | Filesystem Check | Drift Example |
|-------------|-----------------|---------------|
| **Roles** | Role directories exist under docs content path | Config has `operators` but no `operators/` directory |
| **Diataxis elements** | Content type subdirectories exist per role | Config says `developers` has tutorials but no `developers/tutorials/` |
| **Technology** | Correct site scaffolding present | Config says Docusaurus but no `docusaurus.config.js` |
| **Context** | Content in expected location | Config says `within_project` but docs at root level |

### Detection Flow

```
Read docs/.diataxis.md
    │
    ├── Extract: roles, diataxis priorities, technology, context
    │
    ├── Determine DOCS_PATH from technology + context
    │
    ├── For each role in config:
    │   ├── Does role directory exist? (e.g., DOCS_PATH/developers/)
    │   └── For each enabled content type:
    │       └── Does content type subdir exist? (e.g., DOCS_PATH/developers/tutorials/)
    │
    ├── Check for orphaned role directories:
    │   └── Directories in DOCS_PATH that are NOT in config roles
    │
    └── Compile change report
```

### Change Types

| Change Type | Detection | Action Required |
|-------------|-----------|----------------|
| **Role added** | Config role has no directory | Create role + content type directories |
| **Role removed** | Directory exists but role not in config | Archive/remove orphaned directory (with confirmation) |
| **Content type added** | Config enables type but subdir missing | Create content type subdirectory |
| **Content type removed** | Subdir exists but config disables type | Archive/remove (with confirmation if non-empty) |
| **Technology changed** | Site scaffolding doesn't match config | Flag for manual migration — too destructive to automate |

### User Confirmation

When drift is detected, present changes via AskUserQuestion:

```json
{
  "header": "Config Drift",
  "question": "Configuration has changed since docs were last set up. Detected: [summary]. Apply these changes?",
  "multiSelect": false,
  "options": [
    {"label": "Apply changes (Recommended)", "description": "Create missing directories, clean up orphaned content"},
    {"label": "Review details first", "description": "Show full diff of what will change"},
    {"label": "Skip validation", "description": "Proceed with current filesystem as-is"},
    {"label": "Re-initialize", "description": "Run InitializeProject to reconfigure from scratch"}
  ]
}
```

### Cleanup Actions

**On "Apply changes":**

1. **Create missing role directories** with their content type subdirectories
2. **For orphaned directories that are empty:** Remove silently
3. **For orphaned directories with content:** Present file list and ask:

```json
{
  "header": "Orphaned Docs",
  "question": "[role]/ contains [N] files but role was removed from config. What should I do?",
  "multiSelect": false,
  "options": [
    {"label": "Archive to docs/_archive/", "description": "Move files to archive, preserving content"},
    {"label": "Delete", "description": "Permanently remove the directory and its contents"},
    {"label": "Keep", "description": "Leave directory in place despite config mismatch"}
  ]
}
```

4. **Update last_actioned timestamp** in config after successful cleanup

### Technology Change Warning

Technology changes (e.g., Plain Markdown → Docusaurus) are too destructive to automate. When detected:

```
"⚠️ Technology change detected: [old] → [new]

This requires manual migration:
- Current scaffolding is for [old]
- Config now specifies [new]

Options:
1. Run InitializeProject to re-scaffold (preserves docs/.diataxis.md answers)
2. Manually migrate site infrastructure
3. Revert config change"
```

### Workflow Integration

All post-init workflows include this as **Step 0** before their main logic. See each workflow's "Step 0: Validate Configuration" section.

---

## Update Check

**Route to `Workflows/UpdateSkill.md` for update checks and skill updates.**

**Triggers:** "update diataxis skill", "check for updates", "skill version", "is there an update"

The UpdateSkill workflow:
- Checks version against local source (last_updated_from) and canonical source (official GitHub)
- Offers choice of update source if multiple are available
- Preserves install_source metadata and project configs
- Handles deprecations (removes old files)
- Backs up before updating

## References

- `Standard.md` - Complete Diataxis framework documentation
- `docs/.diataxis.md` - Per-project configuration (read this first!)
- `Workflows/InitializeProject.md` - First-use project setup
- `Workflows/PlanDocumentation.md` - Planning workflow
- `Workflows/OrganizeDocumentation.md` - Restructuring workflow
- `Workflows/CreateScaffold.md` - Create doc structure
- `Workflows/GenerateContent.md` - Fill scaffold with content
- [Diataxis.fr](https://diataxis.fr/) - Official Diataxis documentation
