---
marr: standard
version: 1
title: Documentation Standard
scope: All documentation activities including READMEs, docs, and guides

triggers:
  - WHEN creating, modifying, or organizing project documentation
  - WHEN working with README files, guides, or technical specifications
  - WHEN deciding where documentation should live in the project structure
  - WHEN adding explanations, examples, or user-facing content
---

# Documentation Standard

> **AI Agent Instructions**: Follow these rules for all documentation work.
>
> **Scope**: All documentation activities
>
> **Rationale**: Consistent documentation organization ensures projects remain discoverable and maintainable.

---

## Core Rules (NEVER VIOLATE)

1. **All documentation lives in `docs/`** because scattered docs are invisible
2. **Organize by role first, then content type** because users identify by role before need
3. **Keep content types distinct** because mixed purposes confuse readers
4. **Update docs when code changes** because outdated docs mislead users
5. **No AI attribution** because content stands on merit, not origin

---

## Structure

All project documentation MUST be organized by user role, then by content type within each role.

**Content types** follow the [Diátaxis framework](https://diataxis.fr/). Consult the framework documentation to understand its principles before organizing documentation:
- **how-to/** — Task-oriented guides for accomplishing specific goals
- **reference/** — Technical descriptions of system components
- **explanation/** — Conceptual content about design decisions and trade-offs

**Role-first organization** means users navigate to their role before choosing content type. This matches how users think: "I'm an administrator" comes before "I need a how-to guide."

---

## Content Type Requirements

### How-To Guides
- MUST solve a specific task the user has chosen to do
- MUST assume competence — no teaching, just steps
- MUST title with the task: "How to configure X", "How to deploy Y"

### Reference
- MUST describe the system accurately and completely
- MUST be structured around code or product architecture
- MUST be optimized for lookup, not sequential reading

### Explanation
- MUST discuss the "why" behind implementations
- MUST NOT include step-by-step instructions
- MUST connect concepts across the system

---

## Quality Requirements

- Use clear, direct language — technical documentation is not marketing
- Keep docs synchronized with implementation — remove obsolete content
- Provide examples for complex concepts — concrete is clearer than abstract
- Maintain one source of truth per topic — no redundant documentation

---

## Exceptions

**Platform conventions take precedence.** GitHub repository and community files belong at project root per GitHub's conventions.

**Documentation systems define their own structure.** When using Docusaurus, MkDocs, Sphinx, or similar systems, follow their conventions — but integrate role-first organization and Diátaxis content types where the system allows.

**Non-compliant documentation requires user input.** When existing documentation does not meet this standard, ask the user whether they want to maintain, refine, restructure, or recreate it.

---

## Anti-Patterns (FORBIDDEN)

- **Placing docs outside `docs/`** — All documentation in designated directory
- **Mixing content types** — How-to guides with theory, reference that teaches, explanations with procedures
- **Leaving stale docs** — Update or remove, never ignore
- **Creating redundant docs** — One authoritative source per topic
