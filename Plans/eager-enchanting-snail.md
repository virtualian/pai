# Plan: Create GitHub Issue for PAI Directory Move

## Context

Ian wants to relocate `~/.claude/PAI/` to `~/data/PAI/` and update all references. This is a significant infrastructure change because PAI's path is baked into 100+ files across settings, hooks, tools, skills, documentation, and the source repo.

**Core architectural tension:** `PAI_DIR` env var currently = `~/.claude` (Claude Code config root, NOT the PAI subdirectory). It's used for hooks (`${PAI_DIR}/hooks/...`), settings path resolution, MEMORY directory, etc. Moving just `PAI/` out means `PAI_DIR` can no longer serve double duty.

**The hooks directory (`~/.claude/hooks/`) uses relative imports like `../PAI/Tools/Inference`** — these break if PAI/ moves but hooks stay. This is the highest-risk change.

## Task

Create a comprehensive GitHub issue (type: Task) that captures:
1. Complete scope of the move
2. All affected file categories with counts
3. The env var architecture decision
4. Step-by-step execution plan
5. Verification checklist
6. Risk mitigation (symlink transition)

## Execution

1. Create the issue using `gh issue create --repo virtualian/pai` with a detailed body
2. The issue body will include all findings from the audit

## Issue Structure

### Title
`Move PAI installation from ~/.claude/PAI/ to ~/data/PAI/`

### Body sections
- **Problem/Motivation** — why the move
- **Scope** — what moves, what stays
- **Architecture Decision: Env Vars** — introduce `PAI_INSTALL_DIR`
- **Affected Files** — categorized with counts
- **Execution Plan** — ordered steps
- **Verification** — how to confirm success
- **Rollback** — symlink strategy

### Key details for the issue:

**What moves:**
- `~/.claude/PAI/` → `~/data/PAI/`
- `~/.claude/PAI-Install/` → `~/data/PAI-Install/` (associated)

**What stays:**
- `~/.claude/hooks/` — stays (but imports updated)
- `~/.claude/MEMORY/` — stays
- `~/.claude/settings.json` — stays (updated)
- `~/.claude/CLAUDE.md` — stays (updated)
- `~/.config/PAI/` — stays (already separate)

**Env var changes:**
- Keep `PAI_DIR` = `~/.claude` (Claude home, used by hooks/MEMORY/settings)
- Add `PAI_INSTALL_DIR` = `~/data/PAI` (where PAI code lives)
- Update `paths.ts` to expose `getPaiInstallDir()`

**File categories affected:**
1. `settings.json` — add env var, update loadAtStartup paths (~5 changes)
2. `CLAUDE.md` — update 3 hardcoded `~/.claude/PAI/` paths
3. `hooks/lib/paths.ts` — add `getPaiInstallDir()` function
4. Hook .ts files — update 6+ relative imports from `../PAI/` to use new function
5. PAI Tool scripts — update ~12 files with `process.env.HOME + '/.claude'` patterns
6. PAI documentation (.md) — update ~120 path references across ~15 files
7. Skill SKILL.md files — update ~20 `~/.claude/PAI/USER/` references
8. Algorithm v3.7.0.md — update ~8 path references
9. Source repo templates — update installer/releases
10. `LOCAL_PATCHES.md` — update 2 hardcoded paths

**Execution order:**
1. Create `~/data/` directory
2. Update env vars in settings.json (add PAI_INSTALL_DIR)
3. Update paths.ts (add getPaiInstallDir)
4. Update hook imports to use absolute paths via getPaiInstallDir
5. Update PAI internal self-references (Tools/*.ts)
6. Update CLAUDE.md hardcoded paths
7. Update all documentation references
8. Move the directory
9. Create symlink ~/.claude/PAI → ~/data/PAI (transition safety)
10. Test: hooks, Algorithm, Notify.ts, skills
11. Update source repo templates
12. Remove symlink after verification

## Verification

After creating the issue, confirm it exists and has correct labels.

## Critical files
- `/Users/ianmarr/.claude/settings.json` — env vars, hooks, loadAtStartup
- `/Users/ianmarr/.claude/CLAUDE.md` — hardcoded PAI paths
- `/Users/ianmarr/.claude/hooks/lib/paths.ts` — central path resolution
- `/Users/ianmarr/.claude/hooks/*.ts` — relative imports
- `/Users/ianmarr/.claude/PAI/Tools/*.ts` — self-references
- `/Users/ianmarr/.claude/PAI/Algorithm/v3.7.0.md` — path references
- `/Users/ianmarr/.claude/PAI/*.md` — all documentation
