# Frozen — `Releases/v4.0.3+/`

This release tree is **frozen** as of the `v4.0.3+-final` tag (created when issue #166's PR `166-sync-v5-baseline-shift` → `main` merges). No further commits accept changes to `Releases/v4.0.3+/` from this point forward.

## Why frozen

`Releases/v4.0.3+/` was the fork's customised v4.0.3 release tree on top of upstream `danielmiessler/Personal_AI_Infrastructure` v4.0.3. With v5.0.0 ("Life Operating System") shipping upstream as a comprehensive new baseline (PAI 5.0.0, Algorithm 6.3.0, 45 skills, 35 workflows, 67 hooks, single-root `~/.claude/` architecture), the fork's strategic posture changed: rather than continue iterating `Releases/v4.0.3+/`, PAI execution moves to a fresh upstream v5.0.0 install on **marrmini**, and any fork-architecture features deemed worth keeping get ported to that v5.0.0 base via follow-up issues.

## What supersedes it

- **Live runtime**: marrmini's v5.0.0 install at `marrmini:~/.claude/` (single-root; `~/.pai/` does not exist on v5.0.0).
- **Port design doc**: `Plans/v5-0-0-plus-port.md` (generated in step 11 of `Plans/v5-0-0-is-a-major-keen-wall.md`; not yet written at the time of this freeze).
- **Vanilla v5.0.0 baseline snapshot**: `marrair:~/backups/pai/marrmini-fresh-v5.0.0-<timestamp>/.claude/` (mirror; not in git). The exact path is recorded in `reports/v5-comparison/scan-log.txt`.

## Runtime archaeology

For the live state the fork was running just before the baseline shift:

- **marrair runtime backup**: `marrair:~/backups/pai/runtime-marrair-<timestamp>/` containing both `.pai/` and `.claude/` (the fork's two-root architecture). Path recorded in `reports/v5-comparison/scan-log.txt`.
- **Backup is local-only**: NOT committed to git. Total ~1.1 GB; never quoted in any in-repo file.

## Tags

- `v4.0.3+-final` — final commit of `Releases/v4.0.3+/` (this branch HEAD when sync PR merges).
- `pre-v5-baseline-shift` — main branch HEAD immediately before the sync PR (rollback safety; pushed to origin in this session).
- `marrair-final` — final commit on the fork's main branch when issue #166's PR merges (created locally; pushed at PR-merge time).

## What this freeze does NOT do

- Does NOT delete the `Releases/v4.0.3+/` interior. The tree stays in place at-rest, retained for reference.
- Does NOT decommission marrair's `~/.pai/` runtime — that happens later under criteria stated in the v5.0.0+ port design doc.
- Does NOT archive `virtualian/pai` on GitHub — that happens after the v5.0.0+ port issues complete on marrmini (see `ARCHIVED-marrair.md`).
