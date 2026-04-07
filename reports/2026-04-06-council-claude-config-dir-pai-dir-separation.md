# Council Report: CLAUDE_CONFIG_DIR + PAI_DIR Separation Design

**Date:** 2026-04-06
**Issue:** virtualian/pai#98
**Council Members:** CC Platform Architect, PAI System Architect, PAI Operator, Migration Specialist
**Rounds:** 3 (Positions, Responses & Challenges, Synthesis)
**Supersedes:** reports/2026-04-05-council-pai-dir-architecture.md

---

## Decision

Separate PAI installation from Claude Code configuration using two env vars:

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `CLAUDE_CONFIG_DIR` | CC config root (official CC env var) | `~/.claude` | `/Users/ianmarr/.claude` |
| `PAI_DIR` | PAI installation root (redefined) | `~/.pai` | `/Users/ianmarr/.pai` |

`PAI_DIR` is user-configurable at installation time. For this migration: `PAI_DIR=~/.pai`.

---

## Research Findings

### How Settings and Hooks Resolve Env Vars

| Context | Expansion | Verified |
|---------|-----------|----------|
| `settings.json` `env` section values | **NO** — literal strings, no shell expansion | Yes |
| Hook `command` strings | **YES** — CC shell-expands at runtime | Yes |
| `paths.ts` `expandPath()` | **YES** — handles `~`, `$HOME`, `${HOME}` at runtime | Yes |
| `CLAUDE_CONFIG_DIR` | Must be set **before** CC launches (shell profile) | Yes |
| `~/.claude.json` (OAuth) | Does **NOT** respect `CLAUDE_CONFIG_DIR` | Yes |

### Known CLAUDE_CONFIG_DIR Bugs

- **#3833** — Incomplete isolation (some paths still hardcoded to `~/.claude`)
- **#4739** — IDE integration (VS Code) breaks with non-default `CLAUDE_CONFIG_DIR`
- **#15071** — Hardcoded paths in CC ignore `CLAUDE_CONFIG_DIR`

### Current State: PAI_DIR Conflation

`PAI_DIR=/Users/ianmarr/.claude` serves as:
- CC config root (settings.json, hooks, MEMORY, projects/)
- PAI code root (PAI/Tools/, PAI/Algorithm/, PAI/docs)
- Hook command base path (27 `${PAI_DIR}/hooks/` references in settings.json)

This conflation means PAI_DIR cannot be changed without breaking hook discovery.

---

## The Critical Blocker: Hook Command Paths

### Problem

`settings.json` hook commands use `${PAI_DIR}/hooks/`:

```json
"command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
```

Today: `PAI_DIR=~/.claude` → hooks found at `~/.claude/hooks/` ✓
After: `PAI_DIR=~/.pai` → CC looks at `~/.pai/hooks/` ✗ (hooks aren't there)

**Hooks must stay in CC's config directory.** CC discovers hooks from its own config root. Moving hooks outside `~/.claude/` means CC cannot find them.

### Solution (Live-Tested 2026-04-06)

Decouple hook commands from `PAI_DIR` using `CLAUDE_CONFIG_DIR` in `settings.json` env:

```json
"env": {
  "CLAUDE_CONFIG_DIR": "/Users/ianmarr/.claude",
  "PAI_DIR": "/Users/ianmarr/.pai"
}
```

Hook commands change from:
```json
"command": "${PAI_DIR}/hooks/SecurityValidator.hook.ts"
```
To:
```json
"command": "${CLAUDE_CONFIG_DIR}/hooks/SecurityValidator.hook.ts"
```

**Why this works (no chicken-and-egg problem):**

The council originally believed `CLAUDE_CONFIG_DIR` couldn't be set in `settings.json` because CC reads it at startup to find settings.json. **Live testing disproved this.** Setting `CLAUDE_CONFIG_DIR` in settings.json `env` does NOT relocate CC's config directory — CC has already found settings.json by that point. It simply makes `CLAUDE_CONFIG_DIR` available as a `process.env` variable, which hook commands can then reference via shell expansion.

**Live test (2026-04-06):**
1. Added `"CLAUDE_CONFIG_DIR": "/Users/ianmarr/.claude"` to `settings.json` env section
2. Changed one SecurityValidator hook command from `${PAI_DIR}/hooks/...` to `${CLAUDE_CONFIG_DIR}/hooks/...`
3. Triggered the hook — **it fired successfully**
4. Reverted to original settings.json

**Result:** Two variables only. No `CC_HOME`. No third variable. `CLAUDE_CONFIG_DIR` in settings.json env works for hook command expansion without affecting CC's config directory discovery.

**Static dependency flag:** `CLAUDE_CONFIG_DIR` in `settings.json` must be a literal expanded absolute path (`/Users/ianmarr/.claude`). CC does not expand shell variables in env values.

---

## Council Debate

### Round 1: Initial Positions

**CC Platform Architect:** Hooks must stay in `~/.claude/hooks/`. Hook imports should use absolute paths resolved via `process.env.PAI_DIR`. Resolution chain: `CLAUDE_CONFIG_DIR` → `PAI_DIR` → `PAI_CONFIG_DIR`. `getPaiDir()` fallback should change from `~/.claude` to `~/.pai`. Copy-then-switch migration.

**PAI System Architect:** Proposed `CLAUDE_HOME` as intermediate alias. Split `paiPath()` into `codePath()` (PAI code) and `statePath()` (MEMORY, config). Phase 0: introduce alias, Phase 1: tests, Phase 2: classify 671 refs, Phase 3: redefine `PAI_DIR`. Rollback via symlink.

**PAI Operator:** Centralise all `../PAI/Tools/` relative imports through `paths.ts` BEFORE any directory move. Zero downtime, instant rollback at every phase, pre-migration tarball backup. Symlink bridge during transition. Broken hook import = dead session.

**Migration Specialist:** Copy-then-switch (don't move, copy). Introduce `getClaudeConfigDir()` function. **Identified the critical blocker:** settings.json hook commands use `${PAI_DIR}/hooks/` — changing `PAI_DIR` breaks hook discovery.

### Round 2: Responses & Challenges

**CC Platform Architect:** Rejected `CLAUDE_HOME` proposal (Anthropic collision risk). Endorsed copy-then-switch. Proposed `HOOKS_DIR` env var to decouple hook commands from `PAI_DIR`. The 6 relative `../PAI/Tools/` imports in hooks are the canary — test those first.

**PAI System Architect:** Conceded `CLAUDE_HOME`. The hook discovery flaw is real. Proposed keeping `PAI_DIR=~/.claude` during transition, adding `PAI_CODE_DIR` for the new location. Agreed with Operator: centralise imports before any move. Revised migration: (1) centralise imports, (2) introduce code dir var, (3) copy, (4) update paths.ts, (5) validate, (6) convert hooks to thin shims.

**PAI Operator:** Elevated hook command problem to showstopper. Rejected three variables. Endorsed copy-then-switch. Demanded: who audits every `${PAI_DIR}` reference — hook-path vs code-path? Classification must happen before the switch.

**Migration Specialist:** Escalated from risk to hard blocker. If CC doesn't expand the replacement variable in hook commands, the entire migration stops. Demanded verification gate before any work. Centralise imports AND audit `${PAI_DIR}` references simultaneously.

### Round 3: Synthesis

**Unanimous agreement on:**
1. `PAI_DIR` conflates two concerns — CC config root and PAI code root
2. Two variables needed, one for each concern
3. No big-bang migration — copy-then-switch with per-phase rollback
4. Hooks stay physically in `~/.claude/hooks/`
5. Import centralisation through `paths.ts` before any directory move
6. Verification gate: confirm env var expansion in hook commands before proceeding

**Resolution on hook commands:**
CC shell-expands ALL env vars in hook command strings. A new env var (set in `settings.json` env) pointing to `~/.claude` allows hook commands to be decoupled from `PAI_DIR`. Once decoupled, `PAI_DIR` is free to point to PAI code exclusively.

**Remaining disagreements:**
- **Naming:** `CC_HOME` vs `HOOKS_DIR` vs `CLAUDE_HOME` — architectural bikeshed
- **Urgency:** Operator says low-priority; CC Architect says each new hook deepens the coupling debt
- **Third variable risk:** PAI Architect argued three concepts exist (CC config, PAI code, hook execution root) but accepted two variables pragmatically

---

## Architecture Design

### Env Var Resolution Chain

```
settings.json env section (literal values, no expansion)
  ├─ CLAUDE_CONFIG_DIR = /Users/ianmarr/.claude  ← CC config root (hooks, MEMORY, settings)
  ├─ PAI_DIR = /Users/ianmarr/.pai               ← PAI code root (Tools, Algorithm, docs)
  └─ PAI_CONFIG_DIR = /Users/ianmarr/.config/PAI ← XDG user preferences (unchanged)

Hook command strings (shell-expanded at runtime)
  └─ ${CLAUDE_CONFIG_DIR}/hooks/SecurityValidator.hook.ts  ← resolves to ~/.claude/hooks/...

paths.ts runtime resolution
  ├─ getConfigDir()  → CLAUDE_CONFIG_DIR || ~/.claude
  ├─ getPaiDir()     → PAI_DIR || ~/.pai
  └─ expandPath()    → handles ~, $HOME, ${HOME} for any path
```

Note: Setting `CLAUDE_CONFIG_DIR` in settings.json env does NOT relocate CC's config — CC has already found settings.json by that point. It only makes the variable available to `process.env` for hook commands and runtime path resolution.

### paths.ts Redesign

```typescript
// Current (conflated)
getPaiDir()     → PAI_DIR || ~/.claude       // One root for everything
paiPath(...)    → getPaiDir() + segments     // Ambiguous: config or code?

// After separation (two roots)
getConfigDir()  → CLAUDE_CONFIG_DIR || ~/.claude
getPaiDir()     → PAI_DIR || ~/.pai
configPath(...) → getConfigDir() + segments  // hooks, MEMORY, settings
codePath(...)   → getPaiDir() + segments     // PAI/Tools, Algorithm, docs
paiPath(...)    → DEPRECATED → configPath() with console.warn
```

### What Stays Where

| Directory | Root | Variable | Rationale |
|-----------|------|----------|-----------|
| `hooks/` | CC config | `CLAUDE_CONFIG_DIR` | CC discovers hooks from its config dir |
| `MEMORY/` | CC config | `CLAUDE_CONFIG_DIR` | Session state, per-project memory |
| `settings.json` | CC config | `CLAUDE_CONFIG_DIR` | CC config file |
| `projects/` | CC config | `CLAUDE_CONFIG_DIR` | CC auto-memory |
| `CLAUDE.md` | CC config | `CLAUDE_CONFIG_DIR` | CC instruction file |
| `PAI/` | PAI install | `PAI_DIR` | PAI code, tools, algorithms |
| `skills/` | PAI install | `PAI_DIR` | PAI skill definitions |
| `agents/` | PAI install | `PAI_DIR` | PAI agent definitions |
| `PAI-Install/` | PAI install | `PAI_DIR` | Installer engine |
| `VoiceServer/` | PAI install | `PAI_DIR` | Voice notification server |

### Static Dependencies (Cannot Use Env Vars)

| Location | Why | Value |
|----------|-----|-------|
| `settings.json` `env.CLAUDE_CONFIG_DIR` | CC doesn't expand shell vars in env values | `/Users/ianmarr/.claude` |
| `settings.json` `env.PAI_DIR` | CC doesn't expand shell vars in env values | `/Users/ianmarr/.pai` |
| `settings.json` `permissions.additionalDirectories` | Literal paths required | `~/.claude/MEMORY` |
| `~/.claude.json` | OAuth state, ignores CLAUDE_CONFIG_DIR | Hardcoded at `$HOME/.claude.json` |

Everything else can use env vars at runtime via `paths.ts` expansion or shell expansion in hook commands.

---

## File Audit Summary

| Category | Files | References | Migration Action |
|----------|-------|------------|-----------------|
| **settings.json** | 1 | 28 (1 def + 27 hook cmds) | Change env.PAI_DIR value; add CLAUDE_CONFIG_DIR; migrate 27 hook cmds to `${CLAUDE_CONFIG_DIR}` |
| **Hook TS files** | 15 | ~20 relative imports | Centralise through paths.ts `codePath()` |
| **PAI Tool scripts** | 27 | ~70 path constructions | Update to use `getPaiDir()` consistently |
| **PAI documentation** | 12 | 102 hardcoded paths | Bulk replace `~/.claude/PAI/` → `~/.pai/PAI/` |
| **Installer/build** | 18 | 120+ references | Update installer to write new PAI_DIR value |
| **Config files** | 3 | ~10 references | Update CLAUDE.md, template |
| **Skill files** | 3 | ~16 references | Update PAI path refs |
| **Total** | **79** | **~366** | |

---

## Migration Plan

### Pre-Migration Verification Gate

**Must pass before Phase 1 begins:**

**PASSED (2026-04-06).** Live-tested in session:
1. Added `CLAUDE_CONFIG_DIR=/Users/ianmarr/.claude` to `settings.json` env section
2. Changed SecurityValidator Bash hook from `${PAI_DIR}/hooks/...` to `${CLAUDE_CONFIG_DIR}/hooks/...`
3. Triggered Bash tool — hook fired successfully
4. Reverted settings.json to original state

### Phase 0: Centralise Imports (Zero Directory Changes)

**Action:** Convert all 15 hook files' relative `../PAI/Tools/` imports to use `paths.ts` resolvers.

**Before:**
```typescript
import { inference } from '../PAI/Tools/Inference'
```

**After:**
```typescript
import { codePath } from './lib/paths'
const { inference } = await import(codePath('PAI', 'Tools', 'Inference'))
```

**Breakage:** Zero. Same resolution, different mechanism.
**Rollback:** Revert commit.

### Phase 1: Add CLAUDE_CONFIG_DIR + Update paths.ts

**Actions:**
1. Add `CLAUDE_CONFIG_DIR` to `settings.json` env (value: `/Users/ianmarr/.claude`)
2. Update `paths.ts`: add `getConfigDir()`, `configPath()`, `codePath()`. Deprecate `paiPath()`.
3. Write resolution tests for the fallback chain
4. Migrate 27 hook commands from `${PAI_DIR}/hooks/` to `${CLAUDE_CONFIG_DIR}/hooks/`

**Breakage:** Zero. All variables resolve to the same directories.
**Rollback:** Revert `settings.json` and `paths.ts` changes.

### Phase 2: Copy PAI Code + Redefine PAI_DIR

**Actions:**
1. Copy `~/.claude/PAI/` → `~/.pai/PAI/`
2. Copy `~/.claude/skills/` → `~/.pai/skills/`
3. Copy `~/.claude/agents/` → `~/.pai/agents/`
4. Copy `~/.claude/PAI-Install/` → `~/.pai/PAI-Install/`
5. Copy `~/.claude/VoiceServer/` → `~/.pai/VoiceServer/`
6. Update `settings.json` `env.PAI_DIR` from `/Users/ianmarr/.claude` to `/Users/ianmarr/.pai`
7. Update `CLAUDE.md` hardcoded paths (3 references)
8. Update PAI Tool scripts to use `getPaiDir()` consistently

**Breakage:** Low — both locations exist simultaneously.
**Rollback:** Set `env.PAI_DIR` back to `/Users/ianmarr/.claude`. One line.

### Phase 3: Validate + Update Documentation

**Actions:**
1. Verify every hook fires correctly
2. Verify `loadAtStartup` files resolve from new PAI_DIR
3. Verify Algorithm v3.7.0.md loads in new session
4. Verify `bun ~/.pai/PAI/Tools/Notify.ts "test"` works
5. Bulk-replace documentation paths
6. Update installer templates in `Releases/`

**Breakage:** Zero (both locations still exist).
**Rollback:** N/A — documentation changes are non-functional.

### Phase 4: Remove Old PAI Code

**Actions:**
1. Remove `~/.claude/PAI/` (after 2-week validation period)
2. Remove `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/PAI-Install/`, `~/.claude/VoiceServer/`
3. Optionally: symlink old locations to new for safety

**Breakage:** None if Phases 1-3 validated.
**Rollback:** Restore from backup tarball.

### Pre-Migration Backup

```bash
tar czf ~/tmp/pai-pre-migration-$(date +%s).tar.gz \
  ~/.claude/settings.json \
  ~/.claude/hooks/ \
  ~/.claude/PAI/ \
  ~/.claude/skills/ \
  ~/.claude/agents/ \
  ~/.claude/CLAUDE.md
```

---

## Sources

### Official Claude Code
- [code.claude.com/docs/en/claude-directory](https://code.claude.com/docs/en/claude-directory)
- [code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings)
- [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)
- [code.claude.com/docs/en/env-vars](https://code.claude.com/docs/en/env-vars)

### Claude Code GitHub Issues
- [#3833 — CLAUDE_CONFIG_DIR incomplete isolation](https://github.com/anthropics/claude-code/issues/3833)
- [#4739 — IDE integration breaks with CLAUDE_CONFIG_DIR](https://github.com/anthropics/claude-code/issues/4739)
- [#15071 — Hardcoded paths ignore CLAUDE_CONFIG_DIR](https://github.com/anthropics/claude-code/issues/15071)
- [#25762 — Configure .claude directory location](https://github.com/anthropics/claude-code/issues/25762)

### Local Files Examined
- `/Users/ianmarr/.claude/settings.json` — 28 PAI_DIR references
- `/Users/ianmarr/.claude/hooks/lib/paths.ts` — Runtime path resolver
- `/Users/ianmarr/.claude/hooks/*.hook.ts` — 15 hook files with PAI imports
- `/Users/ianmarr/.claude/PAI/Tools/*.ts` — 27 tool scripts
