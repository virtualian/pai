# Archived — marrair fork working tree

This repository (`virtualian/pai`) and its working tree on **marrair** are archived as of the `marrair-final` tag, created when the v5.0.0 baseline-shift PR (issue #166) merges to `main`.

## Why

`virtualian/pai` was a fork of `danielmiessler/Personal_AI_Infrastructure` carrying ~62 fork commits of runtime architecture work (SecurityValidator wiring, two-root `CLAUDE_CONFIG_DIR`/`PAI_DIR`, shared `engine/pai-paths.ts`, Algorithm v3.7.0 with the AskUserQuestion ENUMERATE→OFFER contract, Voice removal, Learning standalone pack, et al.). With v5.0.0 ("Life Operating System") shipping upstream as a comprehensive new baseline, the fork's strategic posture changed: rather than continue carrying ahead-of-upstream architecture work in a long-running fork, PAI execution moves to a fresh clone of upstream on a new machine (**marrmini**), and any fork-architecture features deemed worth keeping get ported onto that v5.0.0 base via follow-up issues.

## Replacement

Active development moves to **`marrmini:~/projects/pai/`** — a direct clone of `danielmiessler/Personal_AI_Infrastructure` (no intermediate GitHub fork). marrmini also runs the v5.0.0 baseline install at `~/.pai/` and `~/.claude/`, populated by upstream's official installer.

## What is preserved

- This repo on marrair stays at-rest, retained for reference; not deleted.
- Tag `marrair-final` marks the final commit on this repo's main branch.
- Tag `pre-v5-baseline-shift` marks the commit immediately before the baseline-shift PR (rollback safety).
- Tag `v4.0.3+-final` marks the final state of `Releases/v4.0.3+/` (frozen tree; see `Releases/v4.0.3+/FROZEN.md`).
- Local backups of the marrair runtime live at `~/backups/pai/runtime-marrair-<timestamp>/` (NOT in git; per `reports/v5-comparison/scan-log.txt`).
- Local backups of marrmini's pre- and post-install state mirror across both machines (NOT in git).

## Out of scope here

- GitHub-side archival of `virtualian/pai` (Settings → Archive) — pending; happens after the v5.0.0+ port issues complete on marrmini.
- Decommission of the marrair `~/.pai/` runtime — pending; criteria in `Plans/v5-0-0-plus-port.md` (the design doc generated in step 11 of `Plans/v5-0-0-is-a-major-keen-wall.md`).
- Future port work — governed by the design doc, not this marker.

For runtime archaeology, see the backup paths recorded in `reports/v5-comparison/scan-log.txt`.
