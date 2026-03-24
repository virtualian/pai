---
marr: standard
version: 1
title: Writing Prompts Standard
scope: Creating and modifying prompt files and standards

triggers:
  - WHEN creating or modifying prompt files or standards
  - WHEN editing CLAUDE.md or MARR configuration files
  - WHEN reviewing prompts or standards for quality
  - WHEN defining rules or constraints for AI agent behavior
---

# Writing Prompts Standard

> **AI Agent Instructions**: This document defines how to create and modify prompt and standard files. ALWAYS follow these rules when writing or updating any prompt or standard.

---

## Prerequisite

**READ the "What is a Standard" section in `MARR-PROJECT-CLAUDE.md` FIRST** if you haven't already this session.

Standards are binding constraints, not guidelines. Understanding what a standard is ensures you write them correctly.

---

## What Are Standards and Prompts?

**Standards and prompts are instructions for AI agents.** They are not documentation for humans.

- **Standards** are prompt files that define binding constraints on AI agent behavior
- **Prompts** are directive documents that guide AI agents toward specific outcomes
- Both are read and followed by AI agents, not by human developers
- The audience is always an AI agent—write accordingly

When you write a prompt or standard, you are programming AI behavior through natural language directives.

---

## Core Rules (NEVER VIOLATE)

1. **Always be User and Project Agnostic** because they must be applicable for any user or project 
2. **Specify WHAT and WHY, never HOW** because AI agents must determine implementation
3. **Never include code, commands, or configuration** because prompts are directives, not tutorials
4. **Write unconditional imperatives** because standards are not suggestions
5. **Make every statement verifiable** because unenforceable rules are not standards
6. **Never modify standards without explicit approval** because standards are controlled documents

---

## Writing Standards

### Content Requirements

**MUST include:**
- Clear statement of what the standard requires
- Rationale (WHY) for each requirement
- Explicit scope (what situations it applies to)

**MUST NOT include:**
- Code snippets or examples
- Terminal commands
- Configuration files
- Step-by-step implementation instructions

### Language Requirements

**Use imperative language:**
- "Must" or "Must not" for requirements
- "Always" or "Never" for absolute rules
- "When" X happens do Y
- Active voice, direct statements

**Correct examples:**
- "ALWAYS use TypeScript for all new code because type safety reduces production errors"
- "NEVER commit secrets because exposed credentials compromise security"
- "ALWAYS run tests before committing because untested changes introduce regressions"
- "WHEN starting work on a feature ALWAYS follow the mandated workflow"

**Incorrect examples:**
- "Run `npm install typescript` then configure tsconfig.json with..."
- "Consider using TypeScript if it makes sense for your project"
- "Here's an example configuration: { ... }"
- "The workflow document defines procedures"

### Structure Requirements

Each standard file must have:
1. **YAML frontmatter** - Structured metadata (see Frontmatter Specification below)
2. **Header** - AI agent instructions, scope, rationale
3. **Triggers section** - Human-readable list matching frontmatter triggers
4. **Core rules** - The non-negotiable requirements
5. **Detailed sections** - Expanded guidance organized by topic
6. **Anti-patterns** - Explicitly forbidden behaviors

---

## Frontmatter Specification

Every standard file MUST begin with YAML frontmatter between `---` delimiters. This frontmatter is machine-parseable and validated by the `marr standard validate` command.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `marr` | `"standard"` | Literal string discriminator. Must be exactly `"standard"`. |
| `version` | positive integer | Schema version. Currently `1`. |
| `title` | non-empty string | Human-readable title of the standard. |
| `scope` | non-empty string | Brief description of when this standard applies. |
| `triggers` | array of strings | Natural language descriptions of triggering situations. At least one required. |

### Example Frontmatter

```yaml
---
marr: standard
version: 1
title: Documentation Standard
scope: All documentation activities including READMEs, docs, and guides

triggers:
  - WHEN creating, modifying, or organizing project documentation
  - WHEN working with README files, guides, or technical specifications
  - WHEN deciding where documentation should live in the project structure
---
```

### Validation

Run `marr standard validate --all` to validate all standards against this schema. The CLI exits non-zero on validation failure, enabling CI integration.

---

## Trigger Design

Triggers determine when an AI agent should read and follow a standard. They are **natural language descriptions** of situations, not mechanical patterns.

### Trigger Philosophy

1. **Semantic over mechanical** — Describe situations an AI can recognize, not file patterns or keywords
2. **Broad over narrow** — It is better to trigger a standard than to miss it
3. **Overlaps allowed** — Multiple standards may be triggered for the same task; scopes should not overlap, but triggers can
4. **Describe situations** — Write triggers as situations the agent might encounter, not mental states

### Trigger Format

Every trigger MUST begin with "WHEN" to make it imperative that an agent reads the standard when the condition is met.

### Good Triggers

- "WHEN creating, modifying, or organizing project documentation"
- "WHEN working with git branches, commits, or pull requests"
- "WHEN making code changes that should have test coverage"
- "WHEN evaluating accessibility or usability"

### Bad Triggers

- "When the user mentions docs" — too narrow, keyword-based
- "*.md files" — mechanical file pattern, not semantic
- "If you think documentation is relevant" — describes mental state, not situation
- "documentation" — single keyword, not a situation description
- "Creating documentation" — missing WHEN prefix

### Trigger Overlap Example

A task like "add a README explaining the new feature" could trigger:
- **Documentation Standard** — "WHEN creating, modifying, or organizing project documentation"
- **Workflow Standard** — "WHEN starting any feature, task, or implementation work"

This overlap is correct. Both standards apply; the agent MUST read both.

---

## Writing Prompts

Prompts are directive documents that guide AI agent behavior. They follow the same principles as standards but allow contextual application.

### Prompt File Principles

- Write directives that specify **WHAT** and **WHY**, never **HOW**
- Write **Triggers** defining **WHEN** directives apply and/or do not apply 
- State requirements and rationale only
- Implementation details belong in project documentation, not prompts
- Prompts are read by AI agents, not humans following tutorials

### Naming Conventions

**Project-level prompts:**
- Format: `prj-{topic}-standard.md`
- Examples: `prj-version-control-standard.md`, `prj-testing-standard.md`

**Location:**
- All prompts live in `.claude/marr/standards/` directory
- Referenced from `MARR-PROJECT-CLAUDE.md` in the Standards table

---

## Version Control

- All standard changes must be committed with clear rationale
- Breaking changes to standards require documentation updates
- Deprecated rules must be explicitly removed, not commented out

---

## Anti-Patterns (FORBIDDEN)

- **Including implementation details** - No code, commands, or config examples
- **Using soft language** - No "should", "consider", "might want to"
- **Writing tutorials** - Standards are not how-to guides
- **Context-dependent exceptions** - If there's an exception, make it explicit in the standard
- **Unverifiable requirements** - Every rule must be objectively checkable
- **Modifying without approval** - Standards are controlled documents

---

## Verifying Prompts and Standards Quality

A well-written standard:

- [ ] Is user and project agnostic
- [ ] Uses "must" or "must not" language
- [ ] Provides rationale for each requirement
- [ ] Does not contain code or commands
- [ ] Can be objectively verified as followed or violated
- [ ] Has clear scope (when it applies)
- [ ] Lists explicit anti-patterns

---

**This standard ensures all project prompts are consistent, enforceable, and effective at guiding AI agent behavior.**
