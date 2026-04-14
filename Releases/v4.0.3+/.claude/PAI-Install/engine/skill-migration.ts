/**
 * PAI Installer v4.0 — Per-Pack Skill Symlinks (GitHub #110)
 *
 * Converts each PAI-owned directory under `~/.claude/skills/<pack>/` into a
 * symlink pointing at `~/.pai/skills/<pack>/`. Claude Code's skill scanner is
 * hardcoded to `~/.claude/skills/`, so the read path stays there while
 * `~/.pai/skills/` becomes the single source of truth.
 *
 * Third-party skills (e.g. tts-tutor-skill) and external symlinks
 * (e.g. find-skills -> ~/.agents/skills/find-skills) are preserved untouched.
 *
 * Ownership rule:
 *   - If `~/.pai/skills/<name>` exists as a real directory → PAI-owned
 *   - If `~/.pai/skills/` is empty (fresh install, right after git clone)
 *     → every top-level dir in `~/.claude/skills/` is PAI-owned. Nothing
 *     third-party could exist at that moment.
 *
 * Precedent: `migrateUserContext` in actions.ts:201 does copy → delete →
 * symlinkSync for `skills/PAI/USER` and `skills/CORE/USER`. This module
 * applies the same pattern at top-level pack granularity.
 *
 * Ordering: runs AFTER `migrateUserContext` in `runRepository`, so any
 * `skills/PAI/USER` or `skills/CORE/USER` subdirs have already been
 * converted to symlinks before our top-level iteration sees them.
 * We also skip any literal `PAI` / `CORE` top-level names defensively.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  lstatSync,
  symlinkSync,
  renameSync,
  rmSync,
  cpSync,
} from "fs";
import { homedir } from "os";
import { join, resolve, relative, basename } from "path";
import type { EngineEventHandler } from "./types";

export type PackClassification =
  | "already-correct-symlink"
  | "external-symlink"
  | "third-party"
  | "pai-only-claude-side"
  | "pai-only-pai-side"
  | "drift-both-sides"
  | "skip-system-dir";

export interface MigrationSummary {
  migrated: number;
  skipped: number;
  backedUp: number;
  failed: number;
}

// Top-level names that must never be processed by this migration.
// Historical v2.x/v3.x user-context homes. `migrateUserContext` in actions.ts
// handles their USER subdirs separately.
const SKIP_SYSTEM_DIRS = new Set(["PAI", "CORE"]);

const IGNORED_ENTRIES = new Set([".DS_Store"]);

// Matches the backup suffix this module creates during drift resolution:
// `<pack>.backup-YYYY-MM-DDTHH-MM-SS-sssZ`. Backups must be invisible to
// subsequent migration runs so they don't get re-symlinked.
const BACKUP_SUFFIX_RE = /\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

function isIgnored(name: string): boolean {
  if (IGNORED_ENTRIES.has(name)) return true;
  if (name.startsWith("._")) return true;
  if (BACKUP_SUFFIX_RE.test(name)) return true;
  return false;
}

/**
 * Resolve the canonical PAI skills directory.
 * Uses PAI_DIR env var if set (test-mode override or custom install layout),
 * otherwise defaults to `~/.pai/skills`. A `~/` or `$HOME/` prefix on the
 * env var value is expanded so user-supplied overrides work.
 *
 * This is DIFFERENT from the installer's `paiDir` variable in actions.ts,
 * which is misleadingly named and always resolves to `~/.claude/`.
 */
function getPaiSkillsDir(): string {
  let envPaiDir = (process.env.PAI_DIR || "").trim();
  if (envPaiDir === "~" || envPaiDir.startsWith("~/")) {
    envPaiDir = join(homedir(), envPaiDir.slice(1));
  } else if (envPaiDir.startsWith("$HOME")) {
    envPaiDir = join(homedir(), envPaiDir.slice("$HOME".length));
  }
  const paiHome = envPaiDir || join(homedir(), ".pai");
  return join(paiHome, "skills");
}

/**
 * Enumerate top-level pack names under `dir` that are real directories
 * (not symlinks, not ignored, not system dirs). Used to compute the PAI-owned
 * set from either the canonical pai tree (normal upgrade) or the claude tree
 * (fresh install, where the pai tree is empty).
 */
function collectOwnedDirs(dir: string): Set<string> {
  const out = new Set<string>();
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (isIgnored(e.name)) continue;
    if (SKIP_SYSTEM_DIRS.has(e.name)) continue;
    if (e.isDirectory() && !e.isSymbolicLink()) {
      out.add(e.name);
    }
  }
  return out;
}

/**
 * `cpSync` filter: skip .DS_Store and macOS resource-fork `._*` files.
 * Applied at every filesystem copy to keep junk out of the canonical tree.
 */
function cpFilter(src: string): boolean {
  return !isIgnored(basename(src));
}

/**
 * Classify a top-level pack name. Pure function — safe to unit-test.
 * Uses lstatSync (never statSync) so `find-skills` (external symlink) is
 * correctly detected as a symbolic link and classified "external-symlink".
 */
export function classifySkillDir(
  name: string,
  claudeSkillsDir: string,
  paiSkillsDir: string,
  paiOwnedSet: Set<string>,
): PackClassification {
  if (SKIP_SYSTEM_DIRS.has(name)) return "skip-system-dir";

  const claudeSide = join(claudeSkillsDir, name);
  const paiSide = join(paiSkillsDir, name);

  let claudeStat: ReturnType<typeof lstatSync> | null = null;
  let paiStat: ReturnType<typeof lstatSync> | null = null;
  try { claudeStat = lstatSync(claudeSide); } catch { /* absent */ }
  try { paiStat = lstatSync(paiSide); } catch { /* absent */ }

  if (claudeStat?.isSymbolicLink()) {
    let target: string;
    try { target = readlinkSync(claudeSide); }
    catch { return "external-symlink"; }
    const resolvedTarget = resolve(claudeSkillsDir, target);
    const expected = resolve(paiSide);
    return resolvedTarget === expected ? "already-correct-symlink" : "external-symlink";
  }

  const claudeIsDir = claudeStat !== null && claudeStat.isDirectory();
  const paiIsDir = paiStat !== null && paiStat.isDirectory() && !paiStat.isSymbolicLink();

  if (!paiOwnedSet.has(name)) {
    return "third-party";
  }

  if (claudeIsDir && paiIsDir) return "drift-both-sides";
  if (claudeIsDir && !paiIsDir) return "pai-only-claude-side";
  if (!claudeIsDir && paiIsDir) return "pai-only-pai-side";

  // Both absent. Shouldn't reach this branch if `name` came from an enumeration.
  return "third-party";
}

type MigrateMode = "move" | "link-only" | "drift";

/**
 * Migrate a single pack. Atomic per-pack state machine with rollback.
 *
 * Modes:
 *   "move"       — claude side has the data; move it to pai, symlink back
 *   "link-only"  — pai side already has the data; just create the symlink
 *   "drift"      — both sides have real dirs; back up pai, move claude over, symlink
 */
async function migratePack(
  name: string,
  claudeSkillsDir: string,
  paiSkillsDir: string,
  mode: MigrateMode,
  summary: MigrationSummary,
  emit: EngineEventHandler,
): Promise<void> {
  const claudeSide = join(claudeSkillsDir, name);
  const paiSide = join(paiSkillsDir, name);
  // Relative symlink target, computed from the symlink's parent directory.
  // Symlink lives at claudeSkillsDir/<name>; parent = claudeSkillsDir.
  const relativeTarget = relative(claudeSkillsDir, paiSide);

  // STATE 1 — drift backup: rename the losing side (pai) to a timestamped sibling.
  let backupPath: string | null = null;
  if (mode === "drift") {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = join(paiSkillsDir, `${name}.backup-${ts}`);
    renameSync(paiSide, backupPath);
    summary.backedUp++;
    await emit({
      event: "message",
      content: `Skill "${name}": drift detected, backed up ~/.pai/skills/${name} → ${basename(backupPath)}`,
    });
  }

  // STATE 2 — move data from claude side into the now-vacated pai slot.
  // `renameSync` is atomic on same-filesystem. EXDEV / ENOTEMPTY fallback uses
  // filtered cpSync + rmSync.
  if (mode === "move" || mode === "drift") {
    try {
      renameSync(claudeSide, paiSide);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "EXDEV" || code === "ENOTEMPTY") {
        // Cross-device or non-empty destination: filtered recursive copy + remove source.
        cpSync(claudeSide, paiSide, {
          recursive: true,
          filter: cpFilter,
          dereference: false,
        });
        rmSync(claudeSide, { recursive: true, force: true });
      } else {
        // Unknown failure — restore backup if we had one and re-throw.
        if (backupPath && !existsSync(paiSide)) {
          try {
            renameSync(backupPath, paiSide);
            summary.backedUp--;
          } catch { /* best effort */ }
        }
        throw err;
      }
    }
  }

  // STATE 3 — create the relative symlink at the claude side.
  try {
    symlinkSync(relativeTarget, claudeSide);
  } catch (err) {
    // Rollback: undo STATE 2 by renaming pai back to claude, then restore backup.
    try {
      if (mode === "move" || mode === "drift") {
        renameSync(paiSide, claudeSide);
      }
      if (backupPath) {
        renameSync(backupPath, paiSide);
        summary.backedUp--;
      }
    } catch { /* best effort */ }
    throw err;
  }

  summary.migrated++;
  await emit({
    event: "message",
    content: `Skill "${name}": migrated to ~/.pai/skills/${name} and symlinked.`,
  });
}

/**
 * Main entry point. Iterates the union of `<claudeDir>/skills` and
 * `<paiSkillsDir>`, classifies each pack, and migrates PAI-owned ones.
 *
 * @param paiDir The installer's `paiDir` variable — SEMANTICALLY the
 *               Claude Code config root (`~/.claude`), despite the misleading
 *               name. Pulled straight from actions.ts's resolution so naming
 *               stays consistent with the rest of that file.
 * @param emit   Installer event handler.
 * @returns      A summary counter of packs migrated/skipped/backed-up/failed.
 *               Soft-fail: a single pack's failure does NOT abort the run.
 */
export async function migratePerPackSymlinks(
  paiDir: string,
  emit: EngineEventHandler,
): Promise<MigrationSummary> {
  const claudeSkillsDir = join(paiDir, "skills");
  const paiSkillsDir = getPaiSkillsDir();
  const summary: MigrationSummary = { migrated: 0, skipped: 0, backedUp: 0, failed: 0 };

  if (!existsSync(claudeSkillsDir)) {
    return summary; // Nothing to migrate.
  }

  // Ensure the canonical PAI skills directory exists. First-time creation on
  // fresh installs — this is the first installer code path that touches
  // `~/.pai/` at all.
  if (!existsSync(paiSkillsDir)) {
    mkdirSync(paiSkillsDir, { recursive: true });
    await emit({
      event: "message",
      content: `Created canonical skill directory at ${paiSkillsDir}.`,
    });
  }

  // Compute the PAI-owned set. Two modes:
  //   - If ~/.pai/skills/ already has real subdirs, trust them as the source of truth.
  //   - Otherwise (fresh install, empty pai side), every non-symlink dir on
  //     the claude side is PAI-owned — nothing third-party can exist yet.
  let paiOwnedSet = collectOwnedDirs(paiSkillsDir);
  if (paiOwnedSet.size === 0) {
    paiOwnedSet = collectOwnedDirs(claudeSkillsDir);
  }

  // Iterate the union of both sides.
  const allNames = new Set<string>();
  for (const e of readdirSync(claudeSkillsDir, { withFileTypes: true })) {
    if (!isIgnored(e.name)) allNames.add(e.name);
  }
  for (const e of readdirSync(paiSkillsDir, { withFileTypes: true })) {
    if (!isIgnored(e.name)) allNames.add(e.name);
  }

  await emit({
    event: "progress",
    step: "repository",
    percent: 80,
    detail: `Canonicalizing ${paiOwnedSet.size} PAI skill packs...`,
  });

  for (const name of allNames) {
    const kind = classifySkillDir(name, claudeSkillsDir, paiSkillsDir, paiOwnedSet);
    try {
      switch (kind) {
        case "already-correct-symlink":
        case "skip-system-dir":
          summary.skipped++;
          break;
        case "external-symlink":
          summary.skipped++;
          await emit({
            event: "message",
            content: `Skill "${name}": external symlink preserved.`,
          });
          break;
        case "third-party":
          summary.skipped++;
          await emit({
            event: "message",
            content: `Skill "${name}": third-party skill preserved.`,
          });
          break;
        case "pai-only-claude-side":
          await migratePack(name, claudeSkillsDir, paiSkillsDir, "move", summary, emit);
          break;
        case "pai-only-pai-side":
          await migratePack(name, claudeSkillsDir, paiSkillsDir, "link-only", summary, emit);
          break;
        case "drift-both-sides":
          await migratePack(name, claudeSkillsDir, paiSkillsDir, "drift", summary, emit);
          break;
      }
    } catch (err) {
      summary.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await emit({
        event: "message",
        content: `Skill "${name}": migration failed — ${msg}`,
      });
    }
  }

  await emit({
    event: "message",
    content:
      `Skill canonicalization: ${summary.migrated} migrated, ` +
      `${summary.skipped} skipped, ${summary.backedUp} backed up, ` +
      `${summary.failed} failed.`,
  });

  return summary;
}

// Exposed for tests only.
export const __testInternals = { getPaiSkillsDir, cpFilter, isIgnored, migratePack };
