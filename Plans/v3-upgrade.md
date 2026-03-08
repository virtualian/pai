# PAI v3.0.0 Upgrade Plan

> **From:** v2.5.0 → **To:** v3.0.0
> **Date:** 2026-02-16
> **Sources:** [Release notes](https://github.com/danielmiessler/Personal_AI_Infrastructure/releases/tag/v3.0.0) | [Releases/v3.0/README.md](https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/Releases/v3.0/README.md) | [Discussion #660](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/660)

---

## What's Changing

| Dimension | v2.5.0 | v3.0.0 |
|-----------|--------|--------|
| Algorithm | v0.2.25 | v1.4.0 (complete rewrite) |
| Skills | 29 | 38 (+10 new) |
| Hooks | 17 | 20 (+3 new) |
| Workflows | 129 | 162 |
| Files | ~44 | ~1,229 |
| Installer | `INSTALL.ts` | `PAI-Install/` (Electron GUI + CLI) |

### Major v3.0 Features

1. **Algorithm v1.4.0** — Constraint extraction, self-interrogation, build drift prevention, verification rehearsal, loop mode with parallel workers
2. **Full Installer System** — Electron GUI wizard + CLI fallback
3. **10 New Skills** — IterativeDepth, Science, Remotion, WorldThreatModelHarness, WriteStory, Evals, USMetrics, ExtractWisdom, Cloudflare, Sales
4. **Agent Teams / Swarm** — Multi-agent coordination with shared task lists
5. **Persistent PRDs** — Requirements that survive across sessions
6. **Voice Personality System** — Configurable personality traits
7. **Inline Verification Methods** — Every ISC criterion tagged with verification approach

### Breaking Changes

- `INSTALL.ts` replaced by `PAI-Install/` directory
- Algorithm v0.2.x → v1.4.0 (complete reasoning rewrite)
- `settings.json` schema updated (installer handles generation)
- VoiceServer registers LaunchAgent on port 8888
- Hook count 17 → 20 (new hooks activate automatically)

---

## Scope

Two **independent** phases. Either can be rolled back without affecting the other.

| Phase | What | Touches |
|-------|------|---------|
| **1. Repo Upgrade** | Get local repo to v3.0.0 | `/Users/ianmarr/projects/pai` only |
| **2. Local Install** | Upgrade the live PAI installation | `~/.claude/` only |

### What We're Preserving

- **Repo:** Only the `03-create-diataxis-documentation-pack` branch (already pushed to origin)
- **Local:** USER/ data, MEMORY/, settings identity values, agents

### What We're Discarding

- **Repo:** Local main history, Plans/, statusline customizations, all other branches — upstream v3.0.0 replaces everything
- **Local:** v2.5 hooks, skills, and system files — v3.0 versions replace them

---

## Phase 1: Repo Upgrade

Touches **only** `/Users/ianmarr/projects/pai`. Does not touch `~/.claude/`.

### Pre-flight

```bash
# Verify diataxis branch is pushed and in sync
git log --oneline origin/03-create-diataxis-documentation-pack -1
git log --oneline 03-create-diataxis-documentation-pack -1
# Both should show: a9973f9
```

### Execute

```bash
# 1. Fetch upstream v3.0.0
git fetch upstream --tags

# 2. Reset main to upstream
git checkout main
git reset --hard upstream/main

# 3. Push updated main to fork
git push origin main --force-with-lease

# 4. Tag for reference
git tag v3.0.0-local
```

### Verify

```bash
# Confirm main matches upstream
git log --oneline -1 main
git log --oneline -1 upstream/main
# Should be identical

# Confirm v3.0.0 tag exists
git tag -l 'v3*'

# Confirm diataxis branch untouched
git log --oneline -1 origin/03-create-diataxis-documentation-pack
# Should still be a9973f9
```

### Rollback

```bash
git checkout main
git reset --hard v2.5.0
git push origin main --force-with-lease
```

### Deferred: Rebase Diataxis Branch

Not part of this upgrade. Separate task for a separate day:

```bash
git checkout 03-create-diataxis-documentation-pack
git rebase main
# Resolve conflicts (diataxis pack should be mostly isolated)
git push origin 03-create-diataxis-documentation-pack --force-with-lease
```

---

## Phase 2: Local Install

Touches **only** `~/.claude/`. Does not touch the repo.

Follows the [official upgrade path](https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/Releases/v3.0/README.md) with fixes from [Discussion #660](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/660).

### Step 1: Backup

```bash
mv ~/.claude ~/.claude-v2.5-backup
```

### Step 2: Copy v3.0 Release

```bash
cp -r ~/projects/pai/Releases/v3.0/.claude ~/
```

### Step 3: Restore settings.json BEFORE Installer

> **Why before?** Community report (Discussion #660): the `cp -r` overwrites settings.json with a template containing unresolved placeholders (`{PRINCIPAL.PRONUNCIATION}`, `YOUR_VOICE_ID_HERE`). Restoring the real settings.json before the installer runs lets the installer's merge logic work correctly.

```bash
cp ~/.claude-v2.5-backup/settings.json ~/.claude/settings.json
```

### Step 4: Run Installer

```bash
cd ~/.claude && ./PAI-Install/install.sh
```

The installer supports three modes:
- **GUI** (default) — Electron window
- **Web** — Browser at localhost:1337
- **CLI** — Terminal-only

It will walk through 8 steps: System Detection → Prerequisites → API Keys → Identity → PAI Repository → Configuration → DA Voice → Validation.

The installer merges user-specific fields (principal, daidentity, env, pai) into the v3.0 settings template. It should preserve identity values from the restored settings.json.

### Step 5: Restore Personal Data

```bash
# USER content (identity, TELOS, contacts, etc.)
cp -r ~/.claude-v2.5-backup/skills/PAI/USER ~/.claude/skills/PAI/USER

# Memory system
cp -r ~/.claude-v2.5-backup/MEMORY ~/.claude/MEMORY
```

### Step 6: Post-Install Verification

```bash
# Identity preserved
grep -E '"name"|"timezone"' ~/.claude/settings.json

# Hooks count (~20 expected)
ls ~/.claude/hooks/*.hook.ts 2>/dev/null | wc -l

# Skills count (~38 expected)
ls ~/.claude/skills/PAI/Components/Skills/ 2>/dev/null | wc -l

# USER data survived
ls ~/.claude/skills/PAI/USER/

# MEMORY survived
ls ~/.claude/MEMORY/

# Agents present
ls ~/.claude/agents/*.md | wc -l
```

### Step 7: Smoke Test

Start a new Claude Code session and verify:
- [ ] Banner loads with v3.0 indicators
- [ ] Algorithm version shows correctly
- [ ] Identity shows "Viki" and "Ian"
- [ ] Hook system activates (FormatReminder fires on first prompt)

### Rollback

```bash
rm -rf ~/.claude
mv ~/.claude-v2.5-backup ~/.claude
```

---

## Known v3.0 Bugs to Check Post-Install

| Bug | What | Check |
|-----|------|-------|
| [#697](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/697) | LATEST says v1.4.0 but actual algorithm file is v1.2.0 | `cat ~/.claude/skills/PAI/Components/Algorithm/LATEST` vs actual file |
| [#691](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/691) | Stale hook names in settings.json (FormatEnforcer, ExplicitRatingCapture, etc.) | Check settings.json for hooks referencing non-existent `.ts` files |
| [#452](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/452) | SecurityValidator stdin hang | Monitor for hook timeouts |
| [#650](https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/650) | settings.json changes don't rebuild SKILL.md | Manual rebuild after any config change |

### Community Workarounds (Discussion #660)

**VoiceServer port conflict:** If you have an existing voice server on port 8888:
```bash
launchctl unload ~/Library/LaunchAgents/com.pai.voice-server.plist
```

**VoiceGate Kitty assumption:** If not using Kitty terminal, the `isMainSession()` check in VoiceGate.hook.ts blocks voice notifications. Fix: add fallback for non-Kitty terminals.

---

## Safe Zones (Not Affected)

| Asset | Why Safe |
|-------|----------|
| Diataxis branch on origin | Not touched by either phase |
| ~/.claude-v2.5-backup | Created before any changes |
| Git remote configuration | Preserved through hard reset |

## Danger Zones (Will Change)

| Asset | Action |
|-------|--------|
| Local main branch | Hard-reset to upstream |
| ~/.claude/ (everything) | Replaced by v3.0 release |
| settings.json schema | New schema, installer merges values |
| Algorithm version | 0.2.25 → 1.4.0 |
| Hook system | 17 → 20 hooks, new signatures possible |
