# MARR Project Configuration

> **AI Agent Instructions**: This document is the entry point for project-level AI agent configuration. Read this file at the start of any session and follow its directives.
>
> **Scope**: All AI agent work in this project
>
> **Rationale**: Centralized configuration ensures consistent agent behavior across all tasks.

---

MARR (Making Agents Really Reliable) provides project-level AI agent configuration.

See `.claude/marr/README.md` for how MARR works, or visit [virtualian.github.io/marr](https://virtualian.github.io/marr).

## What is a Standard

A standard is a **binding constraint** on how you work.

Standards define the boundary between acceptable and unacceptable work. They are not guidelines, recommendations, or best practices. They are **requirements**. If you violate a standard, your work is incorrect.

**Standards are law:**
- They override preferences, convenience, and optimization
- They are not subject to interpretation or context-dependent judgment
- When a standard conflicts with efficiency or elegance, **the standard wins**
- When context seems to suggest an exception, **there is no exception** unless the standard explicitly provides one

**Standards are controlled documents:**
- Never modify standards without explicit user approval
- Even when asked to modify, seek confirmation first

---

## Standards

`standards/` contains standard prompt files that must be followed when working on a related activity.

**IMPORTANT: Conditional Reading Protocol**

1. **DO NOT read standards proactively** — Only read a standard when its trigger condition matches your current task
2. **Evaluate triggers against your current task** — Before each task, scan the trigger list below and identify which (if any) apply
3. **Read triggered standards before proceeding** — When a trigger matches, read the full standard file immediately
4. **Multiple triggers = multiple reads** — If more than one trigger matches, read all corresponding standards

### `prj-documentation-standard.md`
Read this standard when:
- WHEN creating, modifying, or organizing project documentation
- WHEN working with README files, guides, or technical specifications
- WHEN deciding where documentation should live in the project structure
- WHEN adding explanations, examples, or user-facing content

### `prj-mcp-usage-standard.md`
Read this standard when:
- WHEN using MCP tools or integrating external services
- WHEN selecting which tool to use for a task
- WHEN troubleshooting tool behavior or failures
- WHEN configuring or setting up MCP servers

### `prj-testing-standard.md`
Read this standard when:
- WHEN running, writing, or modifying tests
- WHEN evaluating test coverage or testing strategy
- WHEN investigating test failures or flaky tests
- WHEN making code changes that should have test coverage

### `prj-development-workflow-standard.md`
Read this standard when:
- WHEN starting any task or implementation work
- WHEN creating or managing issues
- WHEN preparing a release
- WHEN responding to a production incident

### `prj-version-control-standard.md`
Read this standard when:
- WHEN working with git branches, commits, or merges
- WHEN creating or reviewing pull requests
- WHEN configuring repository settings
- WHEN auditing version control compliance

### `prj-writing-prompts-standard.md`
Read this standard when:
- WHEN creating or modifying prompt files or standards
- WHEN editing CLAUDE.md or MARR configuration files
- WHEN reviewing prompts or standards for quality
- WHEN defining rules or constraints for AI agent behavior

---

## Anti-Patterns (FORBIDDEN)

- **Skipping triggered standards** — Never assume familiarity; always read the standard when triggered
- **Partial standard reads** — Read the entire standard, not just sections that seem relevant
- **Proceeding before reading** — The trigger must be satisfied before continuing work
- **Treating standards as suggestions** — Standards are requirements, not recommendations
- **Making context-dependent exceptions** — If there is no explicit exception in the standard, there is no exception
- **Modifying without approval** — Standards are controlled documents requiring explicit consent
