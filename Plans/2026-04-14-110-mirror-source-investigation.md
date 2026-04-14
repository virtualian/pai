# #110 Mirror-Source Investigation

**Date:** 2026-04-14
**Branch context:** `main` after PR #120 (#115 fix) merge
**Purpose:** Answer the question left open by the #110 investigation-session comment: "the 178 MB structural mirror between `~/.claude/skills/` and `~/.pai/skills/` is not maintained by the installer's current code — whoever implements Option B needs to figure out what creates it."

## TL;DR

**Path A is confirmed: the mirror is static.** No active code path in `Releases/v4.0.3+/.claude/` writes to either `~/.claude/skills/` or `~/.pai/skills/`. The installer's "paiDir" variable is semantically `~/.claude/` (it defaults to `join(homedir(), ".claude")` and every consumer treats it that way) — it never touches `~/.pai/` at all. Current content of `~/.pai/skills/` was populated by an out-of-installer mechanism (likely a Packs-apply script or manual migration) and has not been updated since **Apr 7 2026**, one week before this investigation.

**Implication for Option B:** the implementation does not need to patch a recurring creator. It needs to (a) add symlink logic to the installer for future fresh installs and (b) ship a one-shot converter script for existing machines.

## Evidence

### 1. Installer's `paiDir` variable = `~/.claude/`, not `~/.pai/`

`Releases/v4.0.3+/.claude/PAI-Install/engine/actions.ts:503`:

```ts
const paiDir = state.detection?.paiDir || join(homedir(), ".claude");
```

Confirmed by 8 consumers in the same file:
- `actions.ts:209-210` legacy migration paths (`paiDir/skills/PAI/USER`, `paiDir/skills/CORE/USER`)
- `actions.ts:687-688` skill count for banner (`paiDir/skills/<pack>/SKILL.md`)
- `actions.ts:694` skills dir path
- `detect.ts:93` existing-install signature check (`paiDir/skills/PAI/SKILL.md`)
- `validate.ts:110` skill path validation

The variable **name** is misleading — despite being called `paiDir`, it resolves to `~/.claude/` and all consumers treat it as the Claude-Code config root. This was flagged in #110's existing comment but the significance is now concrete: **the installer has no code path that can touch `~/.pai/skills/`**.

### 2. No skill-directory writes in installer code

Exhaustive grep of `Releases/v4.0.3+/.claude/PAI-Install/engine/` for write operations involving `skills`:

| Pattern | Hits |
|---|---|
| `cpSync.*skills` | 0 |
| `symlinkSync.*skills` | 0 |
| `writeFileSync.*skills` | 0 |
| `mkdirSync.*skills` | Only `requiredDirs` list in `runRepository` which creates empty `skills/` directory as a placeholder if missing |

The only thing `runRepository` does to `~/.claude/skills/` is `mkdirSync` to ensure it exists. Actual skill *content* in `~/.claude/skills/` arrives via the git clone step (`git clone danielmiessler/Personal_AI_Infrastructure.git ~/.claude`) — the upstream repo has `skills/` at root, so git clone drops it there directly.

### 3. `~/.pai/skills/` mtimes prove the tree is static

```
Apr  7 21:05:06 2026  /Users/ianmarr/.pai/skills/Learning
Apr  7 21:05:06 2026  /Users/ianmarr/.pai/skills/Research
Mar 19 13:33:56 2026  /Users/ianmarr/.pai/skills/Agents
Mar 19 13:37:42 2026  /Users/ianmarr/.pai/skills/ContentAnalysis
Mar 19 13:39:46 2026  /Users/ianmarr/.pai/skills/Investigation
Mar 19 13:41:04 2026  /Users/ianmarr/.pai/skills/Media
Mar 19 13:44:16 2026  /Users/ianmarr/.pai/skills/Scraping
Mar 19 13:45:46 2026  /Users/ianmarr/.pai/skills/Security
Mar 19 13:46:52 2026  /Users/ianmarr/.pai/skills/Telos
Mar 19 13:48:34 2026  /Users/ianmarr/.pai/skills/Thinking
Mar 19 13:50:08 2026  /Users/ianmarr/.pai/skills/USMetrics
Mar 19 13:54:45 2026  /Users/ianmarr/.pai/skills/Diataxis-Documentation
Mar 22 16:41:02 2026  /Users/ianmarr/.pai/skills/Utilities
Mar 26 16:54:45 2026  /Users/ianmarr/.pai/skills/find-skills
```

Pattern analysis:
- **Mar 19 13:33-13:54** — initial population batch (12 packs created in ~20 minutes, consistent with a one-shot copy script)
- **Mar 22 / Mar 26** — 2 individual updates (Utilities edited; find-skills added)
- **Apr 7 21:05** — 2 simultaneous updates (Learning + Research — a coordinated edit batch)
- **No updates since Apr 7 21:05** — 7 days of no activity on any pack

Crucially, **#101 (two-root separation) merged on 2026-04-12** — *after* most of this mtime activity. So `~/.pai/skills/` pre-dates the two-root separation, meaning #101 did not create the canonical tree; something earlier did. #101 ratified the CODE-root location in the architecture but didn't install or populate it.

### 4. Fork `Packs/` directory is the likely upstream source

```
/Users/ianmarr/projects/pai/Packs/
├── Agents
├── ContentAnalysis
├── ContextSearch            ← present in Packs, absent in ~/.pai/skills/ (not yet applied?)
├── Investigation
├── Learning
├── Media
├── pai-diataxis-documentation-skill  ← name-mapped to ~/.pai/skills/Diataxis-Documentation
├── Research
├── Scraping
├── Security
├── Telos
├── Thinking
├── USMetrics
└── Utilities
```

This pack-set roughly matches `~/.pai/skills/` (with a rename on Diataxis and one un-applied pack, `ContextSearch`). There is almost certainly an "apply pack" script somewhere in `Tools/` or `Packs/*/src/Workflows/Apply.md` that copies `Packs/<Name>/src/` → `~/.pai/skills/<Name>/`. I did not trace it fully in this investigation because the question was "what maintains the mirror" and the answer is "nothing in the installer" — the Packs apply step is a separate concern.

### 5. Runtime read paths are split between the two trees

`hooks/lib/paths.ts`:

```ts
// Line 87: Get the skills directory (lives in PAI code root)
export function skillsDir(): string {
  return codePath('skills');   // = ~/.pai/skills/
}
```

- **PAI-internal hooks/tools** that use `codePath('skills')` read from `~/.pai/skills/` (the stale tree)
- **Claude Code harness** reads from `~/.claude/skills/` (hardcoded, as documented in #110)
- **Session-start context injection** (if any) needs to be audited — if it uses `codePath` it's reading stale content

This is a *real* correctness issue: any PAI tool that enumerates skills today is seeing Mar 19 content while Claude Code is seeing Apr 7 content. Two separate versions of the same skill set are simultaneously "live."

## Implication for #110 Option B implementation

### Option B variants

The #110 issue proposed Option B as "replace each PAI-owned subdirectory of `~/.claude/skills/` with a symlink to `~/.pai/skills/<PackName>`." This framing has a chicken-and-egg problem: it assumes `~/.pai/skills/` is the canonical source, but the current installer doesn't populate it — so on a fresh install, `~/.pai/skills/` would be empty and the symlinks would point at nothing.

Three concrete implementation plans, ordered by blast radius (lowest first):

#### B-Plan-1 — "Copy-then-symlink" (RECOMMENDED for minimum disruption)

**Flow:**
1. Installer clones upstream → `~/.claude/` (unchanged behavior)
2. **New step:** after clone, for each directory in `~/.claude/skills/`:
   - If the pack is PAI-owned (detected by membership check — see below): `cpSync` it to `~/.pai/skills/<pack>/`, then delete `~/.claude/skills/<pack>/`, then create `symlinkSync(~/.pai/skills/<pack>, ~/.claude/skills/<pack>)`
   - If the pack is third-party (e.g. `tts-tutor-skill` — not present in `~/.pai/skills/` AND not shipped in upstream): leave alone

**PAI-ownership detection:** the simplest heuristic is "anything shipped in the upstream PAI repo is PAI-owned." After git clone, the directories under `~/.claude/skills/` are exactly the upstream-shipped ones. Any third-party pack installed later (e.g. via Claude Code marketplace) lands after install and won't be touched by the installer's symlink step. So the rule becomes: **"At install time, symlink-ify every directory currently in `~/.claude/skills/`; leave anything added later alone."**

**Pros:**
- Minimum disruption to installer architecture
- Installer still clones to `~/.claude/` (no clone-target refactor)
- Existing machines can run a one-shot converter script that uses the same logic
- The "PAI-owned" set is determined by the upstream content, not a manifest file

**Cons:**
- `~/.pai/skills/` becomes a *derivative* of `~/.claude/skills/` (written by the installer after clone), not a canonical source in its own right. This subtly contradicts the #101 framing of `~/.pai/skills/` as the "canonical" location — but since #101 didn't actually implement the canonicalness, this is more a matter of semantic tidiness than regression
- Drift risk persists during the symlink step: if the clone completes but the cpSync fails, the system is in a half-state

#### B-Plan-2 — "Clone-to-PAI-root" (cleanest, biggest refactor)

**Flow:**
1. Installer clones upstream → `~/.pai/` directly (**clone target changes**)
2. `~/.pai/skills/` is populated by git clone (no extra step)
3. **New step:** installer creates `~/.claude/skills/` as a directory containing symlinks pointing at each `~/.pai/skills/<pack>`
4. `~/.claude/` continues to host settings.json, hooks, MEMORY (config root) — but these come from the same clone via a sub-copy step

**Pros:**
- Architecturally pure: `~/.pai/` is the CODE root and canonical source; `~/.claude/` is a thin config layer with symlinks
- Matches #101's stated intent exactly
- No cpSync needed during install — git clone is the only content-write operation

**Cons:**
- **Changes the clone target**, which touches every `paiDir` reference in the installer (~20 sites). Extended/Advanced effort.
- Every file in the upstream repo root that was "supposed to land in `~/.claude/`" (settings.json, hooks/, MEMORY/, CLAUDE.md, etc.) now has to be explicitly copied from `~/.pai/<file>` to `~/.claude/<file>`. This is a non-trivial amount of new cpSync logic.
- Bigger blast radius means higher chance of a regression in fresh-install success rate

#### B-Plan-0 — "Option D and wait" (lowest effort, longest timeline)

Punt to the upstream feature request #110 identified as Option D: get Claude Code to add a `skillsPaths: [...]` field to `settings.json` schema. Once that lands, set `skillsPaths: ["~/.pai/skills"]` and the whole symlink problem disappears.

**Pros:** zero symlinks, zero installer changes, clean architecture.
**Cons:** depends on Anthropic accepting the feature request. Timeline unknown. PAI can't ship it unilaterally.

Not mutually exclusive with B-Plan-1 — we could ship B-Plan-1 now and remove the symlinks later if Option D lands.

## Open questions for next session

1. **Which variant?** My recommendation is **B-Plan-1** (ship now, safest, reversible). B-Plan-2 is architecturally cleaner but the installer refactor risk is real. B-Plan-0 is a parallel track that doesn't block B-Plan-1.

2. **Conflict resolution on existing installs:** the current `~/.claude/skills/` and `~/.pai/skills/` have drifted — `~/.claude/skills/Learning/` is Apr 7 content and `~/.pai/skills/Learning/` is also Apr 7 (matched timestamp); most other packs are Mar 19 in `~/.pai/` but unknown date in `~/.claude/`. A one-shot converter script has to decide which tree's content wins on conflict. **Recommendation: `~/.claude/skills/` wins** because that's the tree the Claude Code harness actually reads and the one the installer populates from fresh clones. Document this; log any conflicts encountered.

3. **Session-start context injection audit:** does any PAI hook or tool use `codePath('skills')` to read content at session start? If yes, those reads are currently hitting the stale `~/.pai/skills/` tree. B-Plan-1 fixes this automatically (the tree becomes fresh after install). But worth auditing explicitly to confirm no other code path is reading stale skills.

4. **How does `Packs/` → `~/.pai/skills/` get applied today?** I didn't trace this. Not required for #110 implementation (B-Plan-1 doesn't care), but worth knowing for completeness. Likely lives in `Tools/` or in `Packs/*/src/Workflows/Apply.md` — either a Pack-apply script or a workflow skill that ships a pack to runtime. This mechanism is what made `~/.pai/skills/Diataxis-Documentation` exist despite the different source name `pai-diataxis-documentation-skill` — there's rename logic somewhere.

5. **Upstream repo layout:** does `danielmiessler/Personal_AI_Infrastructure` have `skills/` at its root? If yes, B-Plan-1 works as designed. If no, the clone mechanism is different and needs to be understood first. One way to verify: shallow clone to a temp dir and list root.

## Status

- ✅ Mirror source question answered: **Path A, static mirror, no installer writes**
- ✅ Three implementation variants scoped with tradeoffs
- ✅ B-Plan-1 recommended as minimum-disruption
- ⏸️ **Stopping here.** No implementation work started. Next session picks up with open questions 1-5 resolved, then writes a design PRD and starts BUILD.

## Related

- Blocks: none
- Related: #110 (issue), #115 (merged as PR #120), #101 (two-root separation ratification), #108 (`.claude/PAI/` mirror — same pattern, different tree), #114 (433+ stale `~/.claude/` doc refs)
- Referenced from: this should probably be linked from #110 as an investigation update once it lands in the repo
