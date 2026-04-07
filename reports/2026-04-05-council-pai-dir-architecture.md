# Council Report: PAI_DIR Architecture and ~/.claude Relationship

**Date:** 2026-04-05
**Issue:** virtualian/pai#98
**Council Members:** PAI System Architect, Claude Code Platform Architect, PAI Operator, Systems Designer
**Rounds:** 3 (Positions, Responses & Challenges, Synthesis)

---

## Research Findings

### (a) How Claude Code Uses ~/.claude

Claude Code treats `~/.claude/` as its user-scope configuration directory.

**CC-created/managed:** `settings.json`, `projects/` (auto-memory), `config/`, `debug/`, `file-history/`, `history.jsonl`, `ide/`, `session-env/`, `plugins/`

**User-extensible:** `CLAUDE.md`, `settings.json`, `keybindings.json`, `rules/`, `skills/`, `commands/`, `agents/`

**Key platform facts:**
- `CLAUDE_CONFIG_DIR` env var can relocate `~/.claude/`, but has known bugs (issues #3833, #4739, #15071 — incomplete isolation, IDE breakage, hardcoded paths)
- `settings.json` `env` section does NOT expand shell variables (`${HOME}` passed literally)
- Hook `command` strings DO get shell-expanded (`${PAI_DIR}` works at runtime)
- `~/.claude` is explicitly documented as user-extensible
- `~/.claude.json` (app state, OAuth) is a SEPARATE file at home root, does NOT respect `CLAUDE_CONFIG_DIR`
- `loadAtStartup` is NOT a CC-native feature — it's a PAI convention implemented by `LoadContext.hook.ts`

**Sources:** code.claude.com/docs/en/claude-directory, code.claude.com/docs/en/settings, code.claude.com/docs/en/hooks, code.claude.com/docs/en/env-vars, anthropics/claude-code issues #3833, #25762, #4276, #26167

### (b) How PAI Uses ~/.claude

PAI installs itself INTO `~/.claude/` as if it IS the Claude home directory.

- `PAI_DIR` env var = `/Users/ianmarr/.claude` (hardcoded absolute path, expanded by installer)
- `getPaiDir()` in `hooks/lib/paths.ts` returns `PAI_DIR` env or falls back to `~/.claude`
- `paiPath('hooks')` = `~/.claude/hooks/`, `paiPath('MEMORY')` = `~/.claude/MEMORY/`, `paiPath('PAI')` = `~/.claude/PAI/`
- PAI_DIR is used for EVERYTHING: hooks, MEMORY, settings, AND PAI code
- The installer respects `CLAUDE_CONFIG_DIR`: `const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(HOME, '.claude')`

**Daniel's documentation comment** (settings.json line 1000):
> `"PAI_DIR": "Root directory for your PAI installation (~/.claude). Skills, hooks, memory live here."`

The old repo literally renamed `.claude/` to `PAI_DIRECTORY/` for vendor agnosticism — PAI_DIRECTORY and `~/.claude/` are the SAME concept.

### (c) The Intent Behind PAI_DIR

**PAI_DIR was always meant to be the Claude home directory, not a pointer to the PAI subdirectory.**

**Git history:**
- Commit `9647d9e` (Nov 25, 2025): "fix: restore PAI_DIR for location-agnostic installation — Users can now install PAI anywhere, not just ~/.claude"
- Commit `99af5ce` (Nov 25, 2025): "standardize all paths to use ${PAI_DIR}/"
- Commit `b49778d` (earlier): PAI_DIR was REMOVED because "Claude Code doesn't expand variables in settings.json"
- Commit `ebccb81` (Feb 2026): Made PAI_DIR aware of CLAUDE_CONFIG_DIR

**Daniel's statements:**
- Discussion #263: "The `PAI_DIR` environment variable in `settings.json` env section is the right hook for multi-environment setups. The v3.0 installer respects `CLAUDE_CONFIG_DIR` as well." — Daniel equated PAI_DIR with CLAUDE_CONFIG_DIR.
- Discussion #11: Community suggested renaming `.claude` folder. Daniel: "Oh great idea." On PAI_DIR being good for this: "100." — PAI_DIR was a portability mechanism.
- Discussion #40: Daniel confirmed PAI_DIRECTORY and `~/.claude/` are equivalent.

**Verdict:** "Location-agnostic installation" meant "you can put the whole Claude home anywhere" — not "you can separate PAI code from Claude config."

---

## Council Debate

### Round 1: Initial Positions

**PAI System Architect:** PAI_DIR = Claude home — the code proves it unambiguously. `paiPath('PAI')` appends `/PAI/` to PAI_DIR, confirming PAI_DIR is the parent. Ian's hypothesis would accidentally work via `paiPath('PAI')` but that's coincidence, not design intent. The name is simply misleading — it should be `CLAUDE_HOME` or `PAI_HOME`. But changing it touches every consumer.

**CC Platform Architect:** PAI_DIR should mean "PAI install root." CC already has `CLAUDE_CONFIG_DIR` for its own config. PAI conflates two concerns — PAI artifacts vs CC artifacts. The coupling breaks the moment anyone wants PAI on a different volume, in a container, or shared across machines. Hook commands get shell-expanded so `${PAI_DIR}` would still work. Recommendation: PAI_DIR should be independent of `CLAUDE_CONFIG_DIR`.

**PAI Operator:** Don't move PAI. 671 references, zero test suite, silent failures. "Cleaner separation" isn't a benefit I can use. A symlink introduces its own bugs — resolution differences between Node, Bun, shell builtins. Show me a concrete operational benefit or it's a no from operations.

**Systems Designer:** The current naming is a lie. `PAI_DIR` → `~/.claude` is not "the PAI directory." `paiPath('PAI', 'Tools')` stutters — "the PAI directory, then PAI again, then Tools." Two variables needed: `CLAUDE_HOME` (where Claude config lives) and `PAI_DIR` (where PAI code lives). `paiPath()` conflates two conceptually different roots through a single function.

### Round 2: Responses & Challenges

**PAI System Architect:** Conceded the conflation point to the Systems Designer. `paiPath('PAI')` and `paiPath('MEMORY')` are conceptually different operations. Pushed back on CC Architect's container argument as premature — PAI runs on one developer's machine. But acknowledged the Operator's "show me a benefit" challenge cuts both ways: the current naming actively misleads new tool authors. Proposed incremental approach: introduce `PAI_CODE_DIR` as computed alias first, deprecate later.

**CC Platform Architect:** Reframed the PAI Architect's "code proves it" argument as proof of coupling, not design intent. The Operator's "671 references, zero tests" argument is the strongest at the table — but it's an argument against HOW we change, not WHETHER we should. Absence of tests doesn't mean coupling is safe — it means we can't prove it's safe. Technical debt described as stability is still technical debt. Migration is alias-and-rename, not reorganisation.

**PAI Operator:** Conceded the container/remote agent scenario is real. Two variables would actually REDUCE risk — making implicit assumptions explicit means you can test each path independently, validate both at startup, fail loudly if either is wrong. That's better than silent conflation. BUT demanded: (1) compatibility shim — old code keeps working, (2) test suite BEFORE migration not after, (3) no big-bang cutover.

**Systems Designer:** Pivoted to zero-cost approach. Don't migrate — just alias. Introduce `CLAUDE_HOME` as the semantic alias for what PAI_DIR actually means today. Let PAI_DIR continue resolving exactly as it does. No references break. No paths change. Just stop lying in new code. Then `paiPath()` gets a one-line clarification: it operates on `CLAUDE_HOME`, falling back to `PAI_DIR`. Existing consumers never notice. Migration cost: near zero. Clarity gain: permanent.

### Round 3: Synthesis

**Unanimous agreement on:**
1. PAI_DIR is a naming conflation — it says "PAI directory" but means "Claude home"
2. Two distinct concepts need two distinct names
3. No big-bang migration — 671 refs with zero tests demands incremental approach
4. Alias-and-shim is the mechanism — new name introduced, old name keeps working

**Remaining disagreements:**
- Naming: `CLAUDE_HOME` vs `CC_CONFIG_DIR` vs `PAI_CLAUDE_HOME` (bikeshed, not architectural)
- Urgency: Operator says low-priority; Platform Architect says prerequisite for containers; Designer says honest naming is always urgent
- Risk of Anthropic naming collision: if CC ships its own `CLAUDE_HOME`, we'd collide

### Can PAI_DIR Just Be Set to ~/data?

**No — not today. Yes — after separation.**

PAI_DIR is currently load-bearing for `$PAI_DIR/hooks/...`, `$PAI_DIR/MEMORY/...`, `$PAI_DIR/settings.json`. Setting it to `~/data` breaks all of those. But once you separate `CLAUDE_HOME=~/.claude` from `PAI_DIR`, then `PAI_DIR=~/data` works — PAI lives at `~/data/PAI/`.

---

## Recommended Path

| Phase | Action | Risk | Breakage |
|-------|--------|------|----------|
| **0** | Add `CLAUDE_HOME` env var as alias for current `PAI_DIR` value. New code uses it. | Zero | Zero |
| **1** | Write path-resolution tests covering the fallback chain | Zero | Zero |
| **2** | Migrate 671 refs: "Claude config" refs → `CLAUDE_HOME`, "PAI code" refs → `PAI_DIR` | Low (per-ref) | Per-ref tested |
| **3** | Redefine `PAI_DIR` to mean PAI install root. Set `PAI_DIR=~/data`. Move directory. | Medium | Covered by Phase 1-2 |
| **4** | Deprecate old shim after 2 release cycles | Low | None if Phase 2 complete |

**Critical framing:** This is a deliberate semantic evolution, not a bug fix. PAI_DIR was always meant to be Claude home (Daniel's docs and code confirm it). Moving PAI code separately requires CHANGING its meaning via controlled migration.

---

## Sources

### Official Claude Code
- [code.claude.com/docs/en/claude-directory](https://code.claude.com/docs/en/claude-directory)
- [code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings)
- [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)
- [code.claude.com/docs/en/env-vars](https://code.claude.com/docs/en/env-vars)
- [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
- [anthropic.com/engineering/claude-code-best-practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Claude Code GitHub Issues
- [#3833 — CLAUDE_CONFIG_DIR incomplete isolation](https://github.com/anthropics/claude-code/issues/3833)
- [#4276 — Env var expansion in settings.json](https://github.com/anthropics/claude-code/issues/4276)
- [#4739 — IDE integration breaks with CLAUDE_CONFIG_DIR](https://github.com/anthropics/claude-code/issues/4739)
- [#15071 — Hardcoded paths ignore CLAUDE_CONFIG_DIR](https://github.com/anthropics/claude-code/issues/15071)
- [#25762 — Configure .claude directory location](https://github.com/anthropics/claude-code/issues/25762)
- [#26167 — ~/.claude.json documentation gap](https://github.com/anthropics/claude-code/issues/26167)

### PAI Upstream
- [Discussion #11 — Vendor agnosticism](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/11)
- [Discussion #40 — PAI_DIRECTORY naming](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/40)
- [Discussion #263 — Multi-environment setup](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/263)
- Git commits: 9647d9e, 99af5ce, b49778d, ebccb81

### Local Files Examined
- `/Users/ianmarr/.claude/settings.json` — PAI_DIR definition
- `/Users/ianmarr/.claude/hooks/lib/paths.ts` — Runtime path resolver
- `/Users/ianmarr/projects/pai/Releases/v4.0.3/.claude/settings.json` — Upstream template
- `/Users/ianmarr/projects/pai/Releases/v4.0.3/.claude/hooks/lib/paths.ts` — Upstream paths.ts
- `/Users/ianmarr/projects/pai/Releases/v4.0.3/.claude/PAI-Install/engine/detect.ts` — Installer detection
