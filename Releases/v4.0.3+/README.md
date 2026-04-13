<div align="center">

# PAI v4.0.3+ — Personal Improvements

**Based on upstream v4.0.3 with personal customizations, new packs, and workflow improvements.**

[![Skills](https://img.shields.io/badge/Skills-63-22C55E?style=flat)](../../skills/)
[![Categories](https://img.shields.io/badge/Categories-13-3B82F6?style=flat)](../../skills/)
[![Hooks](https://img.shields.io/badge/Hooks-21-F97316?style=flat)](../../hooks/)
[![Workflows](https://img.shields.io/badge/Workflows-338-8B5CF6?style=flat)](../../skills/)
[![Tips](https://img.shields.io/badge/Tips-202-10B981?style=flat)](../../)
[![Algorithm](https://img.shields.io/badge/Algorithm-v3.7.0-D97706?style=flat)](../../PAI/Algorithm/)

</div>

---

## About This Release

This is the active development release — all personal improvements and customizations go here. Based on the upstream [`v4.0.3`](../v4.0.3/) release, which is frozen.

---

## What Changed (from upstream v4.0.3)

### Breaking Changes

#### `CLAUDE_CONFIG_DIR` + `PAI_DIR` two-root split

Prior releases conflated Claude Code's own config with the PAI installation under a single `~/.claude/` root. v4.0.3+ splits them in two:

| Root | Env var | Contents |
|------|---------|----------|
| `~/.claude/` | `CLAUDE_CONFIG_DIR` | Claude Code's own config: `settings.json`, `sessions/`, `projects/`, CC's `CLAUDE.md` |
| `~/.pai/` | `PAI_DIR` | PAI installation: `hooks/`, `PAI/`, `skills/`, `agents/`, `VoiceServer/`, `MEMORY/`, `USER/` |

Hook files, skills, agents, and — importantly — `MEMORY/` now live under `~/.pai/`. The `paths.ts` helper module exposes `getConfigDir()`, `getPaiDir()`, `configPath()`, and `codePath()` for programmatic resolution of either root. Both env vars fall back to sensible defaults if unset.

**Required manual migration for v4.0.2 upgraders:** if you have an existing `~/.claude/MEMORY/` directory from a prior release, you must move it to `~/.pai/MEMORY/` **before** running v4.0.3+ for the first time. The installer does not automate this yet (see the open issue on `virtualian/pai` for the migration automator follow-up). Failing to migrate causes the first post-upgrade session to boot with no correction history, no behavioral signals, and no synthesis — and any new writes will land in `~/.pai/MEMORY/`, orphaning the old data.

```bash
# Before your first v4.0.3+ session:
mkdir -p ~/.pai
mv ~/.claude/MEMORY ~/.pai/MEMORY
```

### Upstream Fixes (inherited from v4.0.3)

Community-contributed fixes from open PRs — no new features, no breaking changes.

### Inference & Parsing

| PR | Fix |
|----|-----|
| [#800](https://github.com/danielmiessler/PAI/pull/800) | `Inference.ts` JSON parsing only matched objects `{}` — now handles arrays `[]` too, with validation via `JSON.parse` |

### Documentation & Portability

| PR | Fix |
|----|-----|
| [#836](https://github.com/danielmiessler/PAI/pull/836) | `CONTEXT_ROUTING.md` had 29 dead references to files removed in v4.0 — consolidated to 4 README pointers |
| [#817](https://github.com/danielmiessler/PAI/pull/817) | `WorldThreatModelHarness` hardcoded `~/.claude/` path — now uses `$PAI_DIR` for portability |

### Installer

| PR | Fix |
|----|-----|
| [#846](https://github.com/danielmiessler/PAI/pull/846) | Upgrading from v2.5/v3.0 stranded user context at `skills/PAI/USER/` — installer now migrates files to `PAI/USER/` and creates symlinks for backwards compatibility |

---

## Files Changed (from v4.0.2)

| File | Fixes |
|------|-------|
| `PAI/Tools/Inference.ts` | #800 (JSON array parsing) |
| `PAI/CONTEXT_ROUTING.md` | #836 (dead reference cleanup) |
| `skills/Thinking/WorldThreatModelHarness/SKILL.md` | #817 (PAI_DIR portability) |
| `PAI-Install/engine/actions.ts` | #846 (user context migration) |

---

## Installation

### Fresh Install

```bash
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.3

cp -r .claude ~/ && cd ~/.claude && bash install.sh
```

### Upgrading from v4.0.x

```bash
# 1. Back up
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Migrate MEMORY to the new PAI root (REQUIRED for v4.0.2 upgraders)
#    Skip this step only if ~/.claude/MEMORY/ does not exist.
if [ -d ~/.claude/MEMORY ]; then
  mkdir -p ~/.pai
  mv ~/.claude/MEMORY ~/.pai/MEMORY
fi

# 3. Clone and copy
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.3
cp -r .claude ~/

# 4. Run the installer
cd ~/.claude && bash install.sh

# 5. Rebuild CLAUDE.md
bun ~/.pai/PAI/Tools/BuildCLAUDE.ts
```

### Quick Manual Upgrade (from v4.0.2)

Copy these files from this release over your existing ones:

- `PAI/Tools/Inference.ts` — JSON array parsing fix
- `PAI/CONTEXT_ROUTING.md` — dead reference cleanup
- `skills/Thinking/WorldThreatModelHarness/SKILL.md` — PAI_DIR portability
- `PAI-Install/engine/actions.ts` — user context migration for upgrades

---

## Upgrading from Older Versions

See the [main README](../../README.md#upgrading-from-a-previous-version) for the general upgrade procedure. The installer auto-detects existing installations regardless of which version you're upgrading from.
