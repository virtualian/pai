---
name: PAI Diataxis Documentation Skill
pack-id: pai-diataxis-documentation-skill
version: see src/skills/Diataxis-Documentation/SKILL.md
author: ianmarr
description: Diataxis-based documentation methodology skill - role-first structure, content type separation, installation-time configuration
type: skill
purpose-type: [productivity, development, documentation]
platform: claude-code
dependencies:
  - pai-core-install (required)
keywords: [documentation, diataxis, docs, tutorials, how-to, reference, explanation, methodology]
---

<p align="center">
  <img src="icons/pai-diataxis-documentation-skill.png" alt="PAI Diataxis Documentation Skill" width="256">
</p>


# PAI Diataxis Documentation Skill

> Documentation methodology based on the Diataxis framework. Role-first structure, content type separation, and installation-time configuration.

> **Installation:** This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using the wizard in `INSTALL.md`. The installation dynamically adapts to your system state. See [How AI Installation Works](../../README.md#how-ai-installation-works) for details.

---

## What This Pack Does

This pack provides a complete documentation methodology:

**Diataxis Framework**
- Four content types: Tutorials, How-to Guides, Reference, Explanation
- Role-first structure (who is this documentation for?)
- Clear separation of concerns between content types
- Systematic approach to documentation architecture

**Installation-Time Configuration**
- Wizard captures your documentation roles/audiences
- Configures priority Diataxis elements per role
- Defines documentation sources and priorities
- Sets reorganization exemptions (files to leave in place)

**Core Philosophy:** Documentation serves specific roles. Each role needs specific content types. Configure once at install, apply consistently thereafter.

## The Diataxis Framework

Diataxis divides documentation into four distinct content types based on user needs:

```
                    PRACTICAL                    THEORETICAL
                 (doing/action)               (understanding)
              ┌─────────────────────┬─────────────────────┐
   LEARNING   │     TUTORIALS       │    EXPLANATION      │
   (acquiring)│  learning-oriented  │ understanding-orien │
              │  "Follow along..."  │ "This works by..."  │
              ├─────────────────────┼─────────────────────┤
   WORKING    │    HOW-TO GUIDES    │    REFERENCE        │
   (applying) │   task-oriented     │ information-orient  │
              │  "Do this to..."    │ "API: function()"   │
              └─────────────────────┴─────────────────────┘
```

### Content Type Definitions

| Type | Purpose | Audience State | Key Question |
|------|---------|----------------|--------------|
| **Tutorial** | Learning by doing | New to topic, needs guidance | "How do I get started?" |
| **How-to** | Solving a problem | Has goal, needs steps | "How do I accomplish X?" |
| **Reference** | Looking up facts | Knows what, needs details | "What are the parameters?" |
| **Explanation** | Understanding | Wants to understand why | "Why does this work?" |

### Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Tutorial with too much explanation | Loses focus, overwhelms learner | Move explanation to separate doc |
| How-to that teaches concepts | User wants action, not theory | Link to explanation instead |
| Reference with opinions | Mixes facts with guidance | Keep reference factual only |
| Explanation with steps | Confuses understanding with doing | Split into explanation + how-to |

## Architecture

```
pai-diataxis-documentation-skill/
├── README.md                 # This file
├── INSTALL.md                # Wizard-style installation
├── VERIFY.md                 # Verification checklist
├── icons/
│   └── pai-diataxis-documentation-skill.png
└── src/
    └── skills/
        └── Diataxis-Documentation/
            ├── SKILL.md              # Skill routing and overview
            ├── Standard.md           # Diataxis framework details
            ├── Config.md.template    # User preferences template
            └── Workflows/
                ├── PlanDocumentation.md      # Documentation planning
                ├── OrganizeDocumentation.md  # Restructuring existing docs
                ├── CreateScaffold.md         # Create doc structure
                └── GenerateContent.md        # Fill scaffold with content
```

## The Problem This Solves

### Without Diataxis

1. **Mixed Content** - Tutorials that explain too much, references that wander
2. **Unclear Audience** - Who is this documentation for?
3. **Inconsistent Structure** - Every doc organized differently
4. **Missing Content** - No systematic way to identify gaps
5. **Maintenance Burden** - Hard to know where updates belong

### With Diataxis

1. **Clear Separation** - Each doc has one purpose
2. **Role-First** - Documentation organized by audience first
3. **Consistent Structure** - Predictable patterns across all docs
4. **Gap Analysis** - Framework reveals what's missing
5. **Easy Maintenance** - Updates go to obvious locations

## Scope Rules

### What IS Diataxis Scope

- Documentation in `docs/` directory
- Tutorials, guides, reference docs, explanations
- Documentation site content (Docusaurus, etc.)
- API documentation
- Architecture documentation

### Files Exempt from Reorganization

Standard repo files at project root are NOT reorganized into Diataxis structure, but **may still be used as source material** when generating documentation:
- `README.md` - Project overview
- `LICENSE` / `LICENSE.md` - Legal
- `CONTRIBUTING.md` - Contribution guide
- `CHANGELOG.md` - Version history
- `CODE_OF_CONDUCT.md` - Community standards
- `SECURITY.md` - Security policy
- `.github/*.md` - GitHub templates
- `SKILL.md` files - PAI skill definitions

## Quick Start

After installation:

```
"Plan documentation for this project"     -> PlanDocumentation workflow
"Organize my existing docs"               -> OrganizeDocumentation workflow
"Create a how-to guide for X"             -> CreateScaffold + GenerateContent
"What Diataxis type should this doc be?"  -> SKILL.md guidance
```

## Credits

- **Framework:** [Diataxis](https://diataxis.fr/) by Daniele Procida
- **Pack Author:** Ian Marr
- **License:** MIT
