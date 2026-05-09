# Plan: Migrate PAI From marrair → marrmini, Adopt v5.0.0 As Canonical, Compare & Port

## Context

Upstream `danielmiessler/Personal_AI_Infrastructure` shipped v5.0.0 ("Life
Operating System"). Fork `virtualian/pai` (on marrair) is **62 commits ahead
and 27 commits behind** `upstream/main`.

**Initial framing:** "v5.0.0 mostly supersedes my updates." Phase 1
investigation refuted this — fork's 62 commits are runtime architecture
work upstream lacks (SecurityValidator wiring, two-root
`CLAUDE_CONFIG_DIR`/`PAI_DIR`, shared `engine/pai-paths.ts`, Algorithm v3.7.0
with the AskUserQuestion ENUMERATE→OFFER contract, Voice/Notification
removal, Learning standalone pack). Upstream's 27 commits are mostly
*additive* release artefacts.

**Strategic shift (Ian's call, twice refined):**

1. *First reversal:* the runtime is the source of truth, not the committed
   `Releases/v4.0.3+/` tree. Compare runtime-vs-v5.
2. *Second refinement (this plan):* Ian is migrating PAI execution to a
   different machine. Going forward, PAI runs **only on marrmini** (accessed
   via SSH or Claude Remote). marrair's PAI install becomes legacy.
   Therefore the right experimental design is to compare:
   - **marrair's live runtime** (62 fork commits + accreted state) vs.
   - **a clean v5.0.0 install on marrmini** (vanilla upstream baseline).

The diff exposes exactly what the fork's runtime architecture has accreted
beyond a vanilla v5.0.0 install. The design doc then decides what gets
ported forward (marrair → marrmini) and what gets dropped.

**Decisions confirmed by Ian:**

| Question | Decision |
| --- | --- |
| Snapshot scope | **Both `~/.pai/` and `~/.claude/` in full** |
| Snapshot location | **`~/backups/pai/runtime-<host>-<timestamp>/` (local on each machine, NOT in git)** |
| Comparison report + inventories | **`reports/v5-comparison/` (in-repo, committed) — references backup paths** |
| v4.0.3+ freeze mechanics | **`FROZEN.md` marker + `v4.0.3+-final` tag, leave files in place** |
| Output | **Design doc only at `Plans/v5-0-0-plus-port.md` (no porting yet)** |
| Install source on marrmini | **Upstream's official installer (cleanest vanilla v5.0.0 baseline)** |
| Repo posture re: `Releases/v5.0.0/` import | **Skip — live marrmini install is canonical reference** |
| Fork clone on marrmini | **Required for PR development; cloned to `marrmini:~/projects/pai/`** |
| marrair clone | **Archived (`marrair-final` tag + `ARCHIVED-marrair.md`); not deleted** |
| marrair PAI lifecycle | **Keep running through port; decommission after design-doc-driven ports validate on marrmini** |
| Phased move from marrair to marrmini | **A→B→C→D phases (see "Phased move" section); primary cutover after HIGH-priority ports validate on marrmini** |
| marrmini overlay topology | **Overlay pattern: `~/projects/pai/Releases/v5.0.0-overlay/` holds our fixes (only the files we change). `~/.claude/` stays vanilla — re-applied via `deploy-overlay.sh` after each upstream upgrade. `~/projects/pai/` remotes: `origin` = new personal fork (e.g. `virtualian/PAI-v5`), `upstream` = `danielmiessler/Personal_AI_Infrastructure`. Upstream installer ships a tarball, not a git clone — overlay sidesteps that constraint without putting runtime state (history.jsonl, sessions/, caches) into git.** |

**Out of scope (deferred to follow-up issues governed by the design doc):**
- Actual porting of fork architecture (SecurityValidator, two-root,
  AskUserQuestion contract, Voice removal, Learning standalone pack) onto
  marrmini's v5.0.0 install
- README posture decision (own design conversation)
- Cherry-picks of upstream `12265ed`, `698b15f`, `6e0bcc3` — design doc decides
- Submitting fork architecture as upstream PRs — explicitly declined
- Decommissioning marrair PAI install — happens AFTER ports validate on marrmini

## Phased move from marrair to marrmini

The plan locks "decommission after design-doc-driven ports validate" but
does not stage the move. The phased structure:

| Phase | When | Definition of "primary" |
|---|---|---|
| **A** | Through Step 9 (this PR) | marrair primary. marrmini installed but used only for runtime probes and overlay-tree setup. |
| **B** | After Step 11 design doc names HIGH-priority ports | marrair primary. HIGH-priority items get ported into `~/projects/pai/Releases/v5.0.0-overlay/` on marrmini and deployed via `deploy-overlay.sh`. Trial sessions on marrmini surface friction. |
| **C** | After HIGH-priority ports validate on marrmini | Switch primary to marrmini. marrair stays running as fallback for ~2-4 weeks. |
| **D** | After validation period | Decommission marrair PAI install. Archive `virtualian/pai` on GitHub. |

**Asymmetric blockers** (resolve before advancing each phase):
- MEMORY transfer is uni-directional — once marrmini starts writing memory, syncing back gets messy. Pick a clean cutover moment at C.
- Overlay tree at `~/projects/pai/Releases/v5.0.0-overlay/` and `deploy-overlay.sh` must exist BEFORE Phase B starts daily fixes there, or fixes are unrecoverable.
- Issue #166's Steps 10/11/12 commits land on `virtualian/pai`'s `166-sync-v5-baseline-shift` branch — finishing #166 from marrmini requires cloning virtualian/pai there, which is friction. Prefer to finish #166 on marrair (Phase A) before advancing.

**Intermediate posture (any phase):** short throwaway sessions on marrmini for low-stakes tasks (browse docs, draft notes, explore v5.0.0 features) build muscle memory without committing.

## Overlay pattern for v5.0.0+ fixes

Upstream ships v5.0.0 as a tarball (`curl -sSL https://ourpai.ai/install.sh | bash` extracts a release archive into `~/.claude/`), not a git clone. Editing tarball-installed files directly under `~/.claude/` risks losing fixes on next upgrade and conflates source with runtime state (`history.jsonl`, `sessions/`, caches). Pattern:

- `~/projects/pai/Releases/v5.0.0-overlay/` — git-tracked tree that **mirrors the structure of `~/.claude/`** but contains ONLY files we changed (SKILL.md trims, settings overlays, ported hooks, etc.). Lives in the upstream-direct clone, but as an in-repo overlay subdirectory — does NOT mix with upstream's own tree.
- `~/projects/pai/Tools/deploy-overlay.sh` — rsyncs the overlay tree onto `~/.claude/` after a fresh upstream install. Idempotent. Single command per fix-deployment.
- `~/projects/pai/Tools/check-overlay.sh` — diffs the overlay against the current upstream version of the same paths, warning when upstream has advanced under our overlay (i.e., upstream changed a file we still have a fix for).
- `~/.claude/` itself stays NEVER-git-tracked. Conversation history, session JSONL, caches stay out of git **by construction** — they can't accidentally enter the repo because they're never inside the overlay tree.

### Three deploy classes

Not every file we'd want to change has the same deploy semantics. Three classes (plus runtime state which is excluded entirely):

| Class | Examples | Strategy | Where |
|---|---|---|---|
| **A. Pure overlay** | SKILL.md trims, ported hooks (`SecurityValidator.hook.ts`), modified `Algorithm/*.md`, tools we wrote | Replace (rsync) | In `Releases/v5.0.0-overlay/` |
| **B. Merge-semantics** | `settings.json` (CC adds new keys; user adds permissions), `CLAUDE.md` (user customisation) | Per-file merge logic in `deploy-overlay.sh` (JSON merge, section append) | In overlay, but applied differently |
| **C. Self-updating** | `AISTEERINGRULES.md` (auto-appended by `/learn`), `MEMORY/**/*` (auto-written by AI), `PAI/USER/PRINCIPAL_IDENTITY.md`, `PAI/USER/DA_IDENTITY.md` (auto-updated by `/interview`) | **NEVER in overlay.** Treat as "personalisation transfer" — one-time copy at Phase C cutover, then leave alone | NOT in overlay |
| **D. Runtime state** | `history.jsonl`, `sessions/`, `cache/`, `.credentials.json` | Never tracked | Never in overlay |

**Why this matters:** PAI self-updates some Class-C files (notably `AISTEERINGRULES.md` via the `/learn` skill and `MEMORY/**/*` via the auto-memory system). If those lived in the overlay, every `deploy-overlay.sh` run would stomp accumulated state. The overlay tree contains ONLY Class A and Class B files; Class C is handled outside the regular deploy via the personalisation-transfer list (named in Step 11), and Class D never enters git.

**`check-overlay.sh` diffs overlay against LIVE `~/.claude/`** (not just against upstream's repo), because:
- Live state is what's actually running
- Auto-updates touch live state without touching upstream's repo
- A live-vs-overlay drift signals that either upstream changed under us OR our overlay needs to incorporate something new

**Upgrade workflow when upstream releases v5.x.y:**
1. Re-run upstream installer → fresh v5.x.y tarball lands at `~/.claude/`.
2. `bash Tools/deploy-overlay.sh` → overlay applied; `~/.claude/` is now v5.x.y + our fixes.
3. `bash Tools/check-overlay.sh` → for each conflict, diff and decide:
   - Drop the overlay file (upstream addressed our fix; no longer needed)
   - Keep (still needed; upstream didn't touch the area)
   - Merge (upstream changed the file but our fix is still required on top)

**Settings.json is the canonical Class-B example:** has merge semantics, not overwrite. `deploy-overlay.sh` JSON-merges our settings overlay with the vanilla `settings.json` rather than wholesale-replacing — otherwise new keys CC or PAI adds in v5.x.y would be lost on each deploy. `CLAUDE.md` is the other major Class-B file — section-merge if customised, otherwise overlay-replace is acceptable.

**Upstream PR workflow:** each overlay file is a candidate fix for upstream. Branch off `upstream/main` in the dev clone, copy the overlay's version into the appropriate path, commit, push to personal fork, open PR upstream. If accepted, drop the file from the overlay (no longer needed).

## Recommendation (Headline)

**Tag current state on marrair for rollback. Branch `166-sync-v5-baseline-shift`.
Snapshot marrair's live runtime to `~/backups/pai/runtime-marrair-<timestamp>/`
(local). Run secret-scan hygiene log over the backup. Prepare marrmini: verify
SSH access, snapshot whatever PAI state exists there to
`marrmini:~/backups/pai/pre-v5-install-<timestamp>/`, then decommission. Clone
`virtualian/pai` fork to `marrmini:~/projects/pai/`. Run upstream's official
v5.0.0 installer on marrmini. Snapshot the resulting clean install to
`marrmini:~/backups/pai/runtime-marrmini-fresh-v5.0.0-<timestamp>/` and rsync
a copy back to marrair for comparison. Freeze `Releases/v4.0.3+/` in the repo.
Generate runtime-vs-v5 comparison report at
`reports/v5-comparison/v5-vs-runtime.md`. Derive a port design doc at
`Plans/v5-0-0-plus-port.md`. Open PR for review. No code is ported in this
sync — output is *evidence + plan*, not migration.**

Trade-off: this sync changes runtime state on marrmini (decommission +
clean install). marrair is unchanged operationally; only the repo gets a
freeze marker.

Risks:
- Decommissioning marrmini's existing PAI before validating the clean install
  — mitigated by full backup at step 5.
- Upstream's install URL/script could change between this plan being approved
  and execution — record the resolved upstream commit SHA and install script
  contents in the marrmini post-install snapshot for reproducibility.
- Snapshot timing: install scripts often launch async processes (`bun
  install`, deps). Wait for quiescence before snapshotting.
- Network/SSH reliability for inter-machine snapshot transfer.
- Comparison report could surface architectural decisions invalidating the
  freeze posture — the design doc step is the natural place to revise.

## Playbook

### Step 1 — Snapshot tag for rollback safety (on marrair)

- `git tag pre-v5-baseline-shift main`; `git push origin pre-v5-baseline-shift`.
- Files touched: none.
- **Verify:** `git rev-parse pre-v5-baseline-shift` matches `git rev-parse main`.

### Step 2 — Branch off main (on marrair)

- `git checkout -b 166-sync-v5-baseline-shift main` (or `gh issue develop 166`, which produced the actual branch with the `166-` prefix).
- All sync work happens on this branch. Single PR back to `main` at the end.
- **Verify:** `git rev-parse HEAD` matches `main`; `git branch --show-current`
  returns `166-sync-v5-baseline-shift`.

### Step 3 — Snapshot marrair live runtime to local backup

- Resolve and capture: `BACKUP_MARRAIR=~/backups/pai/runtime-marrair-$(date +%Y%m%d-%H%M%S)/`
- Matches existing `~/backups/pai/` naming convention (e.g.
  `claude-20260414-004729`, `security-skill-20260319-094540`).
- **NOT in repo. NOT in git.**
- Method:
  - `rsync -aH --no-perms --no-owner --no-group $HOME/.pai/ $BACKUP_MARRAIR/.pai/`
  - `rsync -aH --no-perms --no-owner --no-group $HOME/.claude/ $BACKUP_MARRAIR/.claude/`
- Inclusion stance: "in full" per Ian's decision. No exclusion list.
- **Verify:**
  - `du -sh $BACKUP_MARRAIR/` reports a sane size; record value.
  - `find $BACKUP_MARRAIR/.pai/ -maxdepth 1 -type d` lists at minimum:
    `commands/`, `MEMORY/`, `skills/`, `PAI/`.
  - `find $BACKUP_MARRAIR/.claude/ -maxdepth 1 -type f` lists `settings.json`,
    `CLAUDE.md`, `AISTEERINGRULES.md`.
  - `git status` shows zero new files in the working tree.

### Step 4 — Secret-scan hygiene log over marrair backup

Snapshot is local-only and never committed; the scan is at-rest hygiene, not
a git-leak gate.

- Run fork's `.pai-protected.json` patterns plus generic secret regexes
  (`sk-*`, `ghp_*`, `xox[abp]-*`, `ya29.*`, `AKIA*`, `-----BEGIN PRIVATE KEY-----`)
  over `$BACKUP_MARRAIR`.
- Inspect `$BACKUP_MARRAIR/.claude/settings.json` and any `.env*` files
  explicitly.
- Output: `reports/v5-comparison/scan-log.txt` (in-repo, COMMITTED). Contents:
  - Resolved `$BACKUP_MARRAIR` path.
  - `du -sh $BACKUP_MARRAIR` size.
  - Hit count per pattern category. Paths only (relative to `$BACKUP_MARRAIR/`),
    NEVER raw secret values. The scan log is a manifest, not a leak surface.
- Decision after scan:
  - 0 hits → proceed.
  - Hits → record paths only; flag those file categories in the comparison
    report (step 11) as "category-only, never quote contents."
  - Backup size > 1 GB → record value, surface to Ian.
- **Verify:** `scan-log.txt` exists, contains size + hit-count rows, contains
  no raw secret values.

### Step 5 — Prepare marrmini: verify access, backup existing PAI state, decommission

- **Access verification:**
  - `ssh marrmini 'uname -a; echo $HOME; df -h $HOME; which bun node git curl'`
    — confirm OS/arch, home path, free space (need at least 5 GB headroom
    for backup + install + snapshot + buffer), required tooling present.
  - Capture output to `reports/v5-comparison/marrmini-environment.txt`
    (committed) for reproducibility.
- **Backup existing marrmini PAI state:**
  - On marrmini: `BACKUP_MARRMINI_PRE=~/backups/pai/pre-v5-install-$(date +%Y%m%d-%H%M%S)/`
  - `ssh marrmini "rsync -aH --no-perms --no-owner --no-group ~/.pai/ $BACKUP_MARRMINI_PRE/.pai/ 2>/dev/null || true"`
    (the `|| true` handles the case where `~/.pai/` doesn't exist yet —
    record this in the environment file).
  - `ssh marrmini "rsync -aH --no-perms --no-owner --no-group ~/.claude/ $BACKUP_MARRMINI_PRE/.claude/ 2>/dev/null || true"`
  - Pull a mirror copy back to marrair:
    `rsync -aH marrmini:$BACKUP_MARRMINI_PRE/ ~/backups/pai/marrmini-pre-v5-$(date +%Y%m%d-%H%M%S)/`
  - This means the pre-install state is preserved on BOTH machines —
    rollback survives loss of either.
- **Decommission existing PAI on marrmini:**
  - **REQUIRES EXPLICIT IAN APPROVAL BEFORE EXECUTION.** This is destructive
    and there is no automatic path to "undo" beyond the backup.
  - Identify what to remove via the backup inventory (don't `rm -rf` blind).
    Likely: `~/.pai/`, `~/.claude/PAI*`, `~/.claude/skills/` if PAI-installed,
    any PAI-installed bins on `$PATH`.
  - Execute under Ian's eye, one path at a time, after confirming each is
    backed up.
- **Verify:**
  - `BACKUP_MARRMINI_PRE` on both marrmini and marrair, sizes match.
  - `marrmini-environment.txt` committed.
  - After decommission: `ssh marrmini 'ls ~/.pai/ ~/.claude/PAI* 2>&1 | head'`
    confirms cleared (or returns "not found").

### Step 6 — Clone fork to marrmini, mark marrair clone as archived

- Clone fork repo to marrmini's projects directory:
  - `ssh marrmini "git clone git@github.com:virtualian/pai.git ~/projects/pai/"`
  - `ssh marrmini "cd ~/projects/pai && git remote add upstream git@github.com:danielmiessler/Personal_AI_Infrastructure.git && git fetch upstream"`
- The marrmini clone becomes the canonical fork working tree.
- Mark marrair clone as archived (no destructive moves):
  - `git tag marrair-final HEAD` on marrair (fork main branch); push later
    with the sync PR.
  - Create `/Users/ianmarr/projects/pai/ARCHIVED-marrair.md` (in-repo, COMMITTED)
    stating: "This repo's working tree on marrair is archived as of
    `marrair-final` tag. Active development moves to
    `marrmini:~/projects/pai/`. marrair tree retained for reference."
- **Verify:**
  - `ssh marrmini "cd ~/projects/pai && git remote -v"` shows both
    `origin` (virtualian) and `upstream` (danielmiessler).
  - `git tag -l marrair-final` (local on marrair) shows the tag.
  - `cat ARCHIVED-marrair.md` shows the marker.

### Step 7 — Clean v5.0.0 install on marrmini via upstream's official installer

- **REQUIRES EXPLICIT IAN APPROVAL — runs upstream's installer with
  network-fetched script.** Capture install command, fetched script SHA,
  and console output for reproducibility.
- Resolve the upstream install command (likely `curl <upstream-install-url> | bash`
  or equivalent — check `upstream/main:Releases/v5.0.0/README.md` for the
  exact one-line install used in v5.0.0's "One-Line Install" section).
- Capture install script SHA before execution:
  `ssh marrmini "curl -fsSL <install-url> | sha256sum > ~/backups/pai/install-script-sha-$(date +%Y%m%d-%H%M%S).txt"`
- Capture the install script contents alongside:
  `ssh marrmini "curl -fsSL <install-url> > ~/backups/pai/install-script-$(date +%Y%m%d-%H%M%S).sh"`
- Execute installer on marrmini under Ian's supervision. Capture full console
  output to `~/backups/pai/install-log-<timestamp>.txt`.
- **Quiescence wait:** before snapshot (step 8), wait for any background
  install processes to complete. Concrete check:
  `ssh marrmini "while pgrep -f 'bun install|npm install|pip install'; do sleep 5; done"`.
- **Verify:**
  - `ssh marrmini "ls ~/.pai/ ~/.claude/"` shows freshly installed contents.
  - `ssh marrmini "cat ~/.pai/VERSION 2>/dev/null || grep -r 'v5.0.0' ~/.pai/PAI/ | head -3"` confirms v5.0.0.
  - Install command, script SHA, script contents, and console log all
    captured to `~/backups/pai/` on marrmini.
  - `pai` command (or equivalent) on marrmini launches without error.

### Step 8 — Snapshot post-install marrmini state, mirror to marrair

- On marrmini: `BACKUP_MARRMINI_FRESH=~/backups/pai/runtime-marrmini-fresh-v5.0.0-$(date +%Y%m%d-%H%M%S)/`
- `ssh marrmini "rsync -aH --no-perms --no-owner --no-group ~/.pai/ $BACKUP_MARRMINI_FRESH/.pai/"`
- `ssh marrmini "rsync -aH --no-perms --no-owner --no-group ~/.claude/ $BACKUP_MARRMINI_FRESH/.claude/"`
- Pull mirror to marrair:
  `rsync -aH marrmini:$BACKUP_MARRMINI_FRESH/ ~/backups/pai/marrmini-fresh-v5.0.0-$(date +%Y%m%d-%H%M%S)/`
  Capture this resolved local path as `BACKUP_V5_BASELINE`.
- This snapshot is the **vanilla v5.0.0 baseline** the comparison report
  diffs against.
- Same secret-scan hygiene as step 4 (append to `scan-log.txt`):
  - Run scan, log size + hit counts only, no raw values.
- **Verify:**
  - `du -sh $BACKUP_MARRMINI_FRESH` on marrmini and `du -sh $BACKUP_V5_BASELINE`
    on marrair report identical sizes.
  - `BACKUP_V5_BASELINE/.pai/PAI/` contains v5.0.0 runtime markers (Algorithm
    v6.3.0, MEMORY v7.6).
  - `scan-log.txt` updated with marrmini-fresh row.

### Step 9 — Freeze `Releases/v4.0.3+/` in the repo

- Create `Releases/v4.0.3+/FROZEN.md` stating:
  - Frozen as of `git rev-parse v4.0.3+-final`.
  - No further commits accept changes to `Releases/v4.0.3+/`.
  - Superseded by marrmini's v5.0.0 install + the v5.0.0+ port (see
    `Plans/v5-0-0-plus-port.md`).
  - For runtime archaeology, see `~/backups/pai/runtime-marrair-<timestamp>/`
    on marrair (path documented in `reports/v5-comparison/scan-log.txt`).
- Tag current branch HEAD as `v4.0.3+-final` (locally; pushed with the PR).
- Files touched: `Releases/v4.0.3+/FROZEN.md`.
- **Verify:** `cat Releases/v4.0.3+/FROZEN.md` shows marker; `git tag -l v4.0.3+-final`
  shows local tag.

### Step 10 — Generate runtime-vs-v5 comparison report

- Output: `reports/v5-comparison/v5-vs-runtime.md` (in-repo).
- **Multi-day analysis exercise — not a one-shot script.** Sized accordingly.
- Inputs: `BACKUP_MARRAIR` (live fork runtime) vs `BACKUP_V5_BASELINE`
  (clean v5.0.0 install).
- **Mechanical first pass (raw materials):**
  - `diff -rqN $BACKUP_MARRAIR/.pai/ $BACKUP_V5_BASELINE/.pai/ > reports/v5-comparison/inventory-pai.txt`
  - `diff -rqN $BACKUP_MARRAIR/.claude/ $BACKUP_V5_BASELINE/.claude/ > reports/v5-comparison/inventory-claude.txt`
  - Rewrite paths in inventory files from `$BACKUP_*/...` to `<marrair>/...`
    and `<marrmini-fresh>/...` before commit so inventories are
    machine-portable.
- **Structured second pass (categorise every divergent file):**
  Per file, label as one of:
  - `identical` — content match.
  - `formatting-only` — whitespace/path-comment diff.
  - `architectural-port` — marrair has fork architecture worth porting forward
    to marrmini (SecurityValidator, two-root, AskUserQuestion contract, Voice
    removal, Learning standalone pack).
  - `drift` — marrair has accreted state (`/learn` updates to AISTEERINGRULES,
    MEMORY writes, customisation) — port-or-drop decision per item.
  - `personalisation` — user-specific (Ian's identity, preferences) — copy
    over directly, do not "port" via PR.
  - `vanilla-only` — exists in marrmini fresh v5.0.0, not in marrair —
    adopt by default (it's the new baseline).
  - `marrair-only` — exists in marrair, not in v5.0.0 — port-or-drop decision.
- **Per-area prose section (8 areas):**
  - **Algorithm:** marrair v3.7.0 vs marrmini fresh v6.3.0 — narrative
    comparison. Critical: v3.7.0's AskUserQuestion ENUMERATE→OFFER contract
    likely absent from v6.3.0.
  - **MEMORY:** marrair structure vs marrmini fresh v7.6 layout.
  - **Skills:** count + per-skill divergence; consider marrair's per-pack
    symlink canonicalisation (`6a8f4a2`).
  - **SecurityValidator:** marrair has full wiring (#156–#160); marrmini fresh
    has none unless v5.0.0 ships it — confirm and quantify.
  - **PAI-Install / installer engine:** marrair has fork's `engine/exec.ts`,
    `engine/pai-paths.ts`, `engine/pai-runtime-migration.ts`. marrmini fresh
    has whatever v5.0.0 ships (plus upstream c493534 PAI-Install fix).
    Engine-by-engine compare.
  - **AISTEERINGRULES:** marrair has `/learn`-accumulated rules. Categorise
    each: still relevant, drift, port forward.
  - **Hooks:** marrair Voice removal cascade vs marrmini fresh v5.0.0 hooks.
  - **Two-root separation (`CLAUDE_CONFIG_DIR`/`PAI_DIR`):** does v5.0.0
    have any awareness, or does it still inline path resolution?
- **Verify:** report has a categorised entry for every divergent file in the
  inventories; 8 per-area prose sections present and substantive.

### Step 11 — Generate v5.0.0+ port design doc

- Output: `Plans/v5-0-0-plus-port.md`.
- Driven by step 10's comparison report. Specific outputs:
  - **Port priority list** — every `architectural-port` item ranked
    HIGH/MED/LOW with rationale. Recommend HIGH for SecurityValidator,
    two-root, AskUserQuestion contract; MED for Voice removal, Learning
    standalone pack; LOW for installer engine refactor.
  - **Drop list** — `drift` and `marrair-only` items NOT ported, with reason.
  - **Adopt list** — `vanilla-only` items to keep verbatim from v5.0.0.
  - **Personalisation transfer list** — user-specific files to copy
    directly to marrmini (no PR overhead).
  - **Path strategy** — how ports apply to marrmini: do they live under
    `Releases/v5.0.0/` in the fork repo (which then re-installs to marrmini)
    or as `Releases/v5.0.0+/` overlay or as marrmini-only patches outside
    the repo? Decision needed before any porting starts. Preliminary lean:
    fork commits live in `Releases/v5.0.0/` (treating v5.0.0 as the new
    fork-extended baseline), get installed to marrmini via the existing
    install flow.
  - **Sequencing** — first batch of issues to file under `virtualian/pai`,
    each scoped to one architectural feature. Serial workflow.
  - **marrair decommission criteria** — what specific ports must validate on
    marrmini before marrair PAI is decommissioned. Default: HIGH-priority
    items (SecurityValidator, two-root, AskUserQuestion contract) ported
    AND personalisation transferred AND `pai` REPL functionally equivalent.
- **Verify:** design doc covers every HIGH-priority item; path strategy
  decided; first 3 issues explicitly named; decommission criteria stated.

### Step 11 focused-session structure

The plan describes Step 11 as design-doc generation driven by Step 10's
multi-day prose report. In practice, a focused session produces a thinner
just-enough version sufficient to drive port priorities — without
blocking on Step 10's full-prose deliverable.

| Stage | Time | Output |
|---|---|---|
| Targeted diff | 30–60 min | `diff -rqN` between the two backup trees, filtered to high-leverage areas only (Algorithm, hooks, AISTEERINGRULES, SecurityValidator, two-root). NOT the full 8-prose-section report. |
| Categorise + rank | 30–60 min | Each architectural-port item → HIGH/MED/LOW + one-sentence rationale |
| Build initial overlay | 30–60 min | Create `~/projects/pai/Releases/v5.0.0-overlay/` with HIGH-priority ports populated; write `Tools/deploy-overlay.sh` and `Tools/check-overlay.sh` |
| Write design doc | 30–60 min | `Plans/v5-0-0-plus-port.md` — port priority list, drop list, adopt list, personalisation transfer list, **overlay path strategy** confirmed (`Releases/v5.0.0-overlay/`), sequencing of first 3 follow-up issues, marrair decommission criteria |
| File first 1–3 issues | 15–30 min | GitHub issues against new personal fork for first 3 ports |

Total: half-day to a day. Output gates Phase B (start daily porting work onto marrmini's overlay).

The full Step 10 prose report can come later as archaeological reference; it does not block the port work.

### Step 12 — Open PR `166-sync-v5-baseline-shift` → `main`

- Per Ian's approval rules: do NOT auto-merge. Wait for explicit approval.
- PR opened from marrair (where this sync runs).
- PR body:
  - Link this plan file.
  - Summarise: marrair runtime backed up locally; marrmini decommissioned +
    clean v5.0.0 installed via upstream installer; both snapshots live in
    `~/backups/pai/` (off-repo); marrair clone archived (`marrair-final` +
    `ARCHIVED-marrair.md`); v4.0.3+ frozen; comparison report at
    `reports/v5-comparison/v5-vs-runtime.md`; design doc at
    `Plans/v5-0-0-plus-port.md`.
  - Explicitly state: NO code ported in this sync; marrair PAI still running;
    decommission gated on design-doc-driven port validation.
- After merge:
  - `git push origin v4.0.3+-final` and `git push origin marrair-final`.
  - On marrmini: `cd ~/projects/pai && git pull` to sync the new repo state.
- **Verify:** `gh pr view --repo virtualian/pai` shows PR open against `main`.

## End-to-end Verification

Before opening the PR (step 12):

1. **Backup integrity (off-repo):**
   - `BACKUP_MARRAIR` exists at `~/backups/pai/runtime-marrair-<ts>/` on marrair.
   - `BACKUP_MARRMINI_PRE` exists on BOTH marrmini and marrair (mirror).
   - `BACKUP_V5_BASELINE` exists at `~/backups/pai/marrmini-fresh-v5.0.0-<ts>/`
     on marrair (mirrored from marrmini's `BACKUP_MARRMINI_FRESH`).
   - `git status` shows no new files under `~/backups/`.
   - `scan-log.txt` committed, references all backup paths absolutely,
     contains size + hit-count rows, no raw secret values.

2. **marrmini install reproducibility:**
   - Install command, fetched script SHA + contents, and console log all in
     `~/backups/pai/` on marrmini.
   - `marrmini-environment.txt` committed.

3. **v4.0.3+ freeze:**
   - `cat Releases/v4.0.3+/FROZEN.md` shows marker.
   - `git tag -l v4.0.3+-final` shows local tag.
   - No commits in this sync touch `Releases/v4.0.3+/` other than `FROZEN.md`.

4. **marrair clone archive:**
   - `git tag -l marrair-final` shows local tag.
   - `cat ARCHIVED-marrair.md` shows marker.
   - marrmini clone exists at `~/projects/pai/` with both `origin` and
     `upstream` remotes.

5. **Comparison report completeness:**
   - Every divergent file in `inventory-pai.txt` and `inventory-claude.txt`
     has a category label.
   - 8 per-area prose sections present.

6. **Design doc completeness:**
   - HIGH/MED/LOW port priorities for every `architectural-port` item.
   - Path strategy decided.
   - First 3 follow-up issues named.
   - marrair decommission criteria stated.

7. **No marrair runtime regressions:**
   - `Tools/verify-security-validator.sh` still runs against live marrair
     install (we only snapshotted, didn't modify). PASS=8 FAIL=0.
   - `pai` REPL on marrair still launches.

8. **marrmini operational:**
   - `ssh marrmini "pai"` (or equivalent) launches v5.0.0 REPL.
   - marrmini's v5.0.0 install is the canonical reference for all subsequent
     porting decisions.

## Critical Files

Created by this sync, in repo (committed):
- `/Users/ianmarr/projects/pai/reports/v5-comparison/scan-log.txt`
- `/Users/ianmarr/projects/pai/reports/v5-comparison/marrmini-environment.txt`
- `/Users/ianmarr/projects/pai/reports/v5-comparison/inventory-pai.txt`
- `/Users/ianmarr/projects/pai/reports/v5-comparison/inventory-claude.txt`
- `/Users/ianmarr/projects/pai/reports/v5-comparison/v5-vs-runtime.md`
- `/Users/ianmarr/projects/pai/Plans/v5-0-0-plus-port.md`
- `/Users/ianmarr/projects/pai/Releases/v4.0.3+/FROZEN.md`
- `/Users/ianmarr/projects/pai/ARCHIVED-marrair.md`

Created by this sync, OUTSIDE repo (local backups, NOT committed):
- On marrair:
  - `~/backups/pai/runtime-marrair-<timestamp>/.pai/` and `.claude/`
  - `~/backups/pai/marrmini-pre-v5-<timestamp>/` (mirror of marrmini pre-install)
  - `~/backups/pai/marrmini-fresh-v5.0.0-<timestamp>/` (mirror of marrmini post-install)
- On marrmini:
  - `~/backups/pai/pre-v5-install-<timestamp>/.pai/` and `.claude/`
  - `~/backups/pai/runtime-marrmini-fresh-v5.0.0-<timestamp>/.pai/` and `.claude/`
  - `~/backups/pai/install-script-<timestamp>.sh` (captured installer)
  - `~/backups/pai/install-script-sha-<timestamp>.txt`
  - `~/backups/pai/install-log-<timestamp>.txt`

Created by this sync, ON marrmini in `~/projects/`:
- `~/projects/pai/` — fresh fork clone (origin: `virtualian/pai`,
  upstream: `danielmiessler/Personal_AI_Infrastructure`)

Reused (read-only):
- `/Users/ianmarr/projects/pai/Tools/UpstreamScan.ts` — secret scanner
  if surface accepts arbitrary paths; otherwise wrap.
- `/Users/ianmarr/projects/pai/.pai-protected.json` — pattern source.
- `/Users/ianmarr/projects/pai/Tools/verify-security-validator.sh` — runtime
  acceptance harness; runs against `~/.pai/`, unaffected by this sync.

NOT touched by this sync (explicit non-scope):
- `/Users/ianmarr/projects/pai/Releases/v4.0.3+/` interior (only `FROZEN.md` added)
- `/Users/ianmarr/projects/pai/Releases/v5.0.0/` — NOT imported (live marrmini
  install is canonical; explicit Ian decision)
- `/Users/ianmarr/projects/pai/Releases/Pi/` — not imported in this sync
- `/Users/ianmarr/projects/pai/README.md` — design conversation deferred
- `/Users/ianmarr/projects/pai/.pai-protected.json` — upstream `6e0bcc3`
  cherry-pick deferred to design-doc-governed follow-up
- `/Users/ianmarr/projects/pai/Packs/` — 40 upstream scaffolds NOT imported
- marrair's live `~/.pai/` and `~/.claude/` — only read for snapshot
- marrair PAI install — kept running through port; decommission later
