#!/usr/bin/env bun

/**
 * UpgradeCheck.ts — Pre-upgrade analysis for locally patched PAI installs
 *
 * Parses LOCAL_PATCHES.md, diffs each active patch against the target release,
 * checks linked GitHub issues, and produces a structured report.
 *
 * Adapted from jlacour-git's solution (danielmiessler/Personal_AI_Infrastructure#923).
 *
 * Usage:
 *   bun Tools/UpgradeCheck.ts v4.0.3
 *   bun Tools/UpgradeCheck.ts v4.0.3 --backup
 *   bun Tools/UpgradeCheck.ts v4.0.3 --no-gh
 *   bun Tools/UpgradeCheck.ts v4.0.3 --repo ~/projects/pai
 *
 * Output: Structured report classifying each patch as SAFE, CONFLICT, or RETIRE
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, ".claude");
const DEFAULT_REPO = process.env.PAI_REPO || join(process.env.HOME!, "projects", "pai");

// ─── Argument parsing ────────────────────────────────────────────────────────

function flag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const targetVersion = process.argv[2];
const repoPath = flag("repo") || DEFAULT_REPO;
const doBackup = hasFlag("backup");
const skipGh = hasFlag("no-gh");

if (!targetVersion || targetVersion.startsWith("--")) {
  console.error(`Usage: bun UpgradeCheck.ts <target-version> [--backup] [--no-gh] [--repo <path>]
Example: bun UpgradeCheck.ts v4.0.3 --backup`);
  process.exit(1);
}

// ─── LOCAL_PATCHES.md parser ─────────────────────────────────────────────────

interface Patch {
  id: string;
  title: string;
  files: string[];
  issueUrl: string | null;
  issueNumber: string | null;
  status: "ACTIVE" | "RETIRED";
}

function parseLocalPatches(content: string): Patch[] {
  const patches: Patch[] = [];
  const lines = content.split("\n");

  let inActiveSection = false;
  let currentPatch: Partial<Patch> | null = null;

  for (const line of lines) {
    if (line.match(/^## Active Patches/)) {
      inActiveSection = true;
      continue;
    }
    if (inActiveSection && line.match(/^## /) && !line.match(/^## Active/)) {
      inActiveSection = false;
      if (currentPatch?.id) patches.push(currentPatch as Patch);
      continue;
    }

    if (!inActiveSection) continue;

    const headerMatch = line.match(/^### (?:~~)?(\d+)\.\s+(.+?)(?:~~.*)?$/);
    if (headerMatch) {
      if (currentPatch?.id) patches.push(currentPatch as Patch);
      const isRetired = line.includes("~~");
      currentPatch = {
        id: headerMatch[1],
        title: headerMatch[2].replace(/~~/g, "").trim(),
        files: [],
        issueUrl: null,
        issueNumber: null,
        status: isRetired ? "RETIRED" : "ACTIVE",
      };
      continue;
    }

    if (!currentPatch) continue;

    const fileMatch = line.match(/\*\*Files?:\*\*\s+(.+)/);
    if (fileMatch) {
      const filePart = fileMatch[1];
      const paths = filePart.match(/`([^`]+)`/g);
      if (paths) {
        for (const p of paths) {
          const clean = p.replace(/`/g, "").trim();
          if (clean && !clean.includes("(") && !clean.startsWith("_")) {
            currentPatch.files!.push(clean);
          }
        }
      }
      continue;
    }

    const issueMatch = line.match(/\*\*Issue:\*\*\s+\[.*?\]\((https:\/\/[^)]+)\)/);
    if (issueMatch) {
      currentPatch.issueUrl = issueMatch[1];
      const numMatch = issueMatch[1].match(/\/(\d+)$/);
      if (numMatch) currentPatch.issueNumber = numMatch[1];
      continue;
    }
  }

  if (currentPatch?.id) patches.push(currentPatch as Patch);

  return patches.filter((p) => p.status === "ACTIVE");
}

// ─── Git operations ──────────────────────────────────────────────────────────

function gitCmd(cmd: string): string | null {
  try {
    return execSync(cmd, { cwd: repoPath, encoding: "utf-8", timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

function fetchUpstream(): boolean {
  const result = gitCmd("git fetch upstream --tags 2>/dev/null") ??
                 gitCmd("git fetch origin --tags 2>/dev/null");
  return result !== null;
}

function releaseFilePath(version: string, filePath: string): string {
  return `${version}:Releases/${version}/.claude/${filePath}`;
}

function diffTwoFiles(pathA: string, pathB: string): { differs: boolean; lineCount: number } {
  try {
    execSync(`diff "${pathA}" "${pathB}"`, { encoding: "utf-8", timeout: 5000 });
    return { differs: false, lineCount: 0 };
  } catch (err: any) {
    if (err.status === 1 && err.stdout) {
      const lineCount = err.stdout.split("\n").filter((l: string) => l.startsWith("<") || l.startsWith(">")).length;
      return { differs: true, lineCount };
    }
    return { differs: false, lineCount: 0 };
  }
}

function diffPatchedFile(version: string, filePath: string, baseVersion: string): { upstreamChanged: boolean; localDiffers: boolean; summary: string } {
  const localPath = join(PAI_DIR, filePath);

  if (!existsSync(localPath)) {
    return { upstreamChanged: false, localDiffers: false, summary: "Local file missing (custom file?)" };
  }

  // Fetch content directly — null means file doesn't exist in that release
  const baseContent = gitCmd(`git show ${releaseFilePath(baseVersion, filePath)} 2>/dev/null`);
  const targetContent = gitCmd(`git show ${releaseFilePath(version, filePath)} 2>/dev/null`);

  if (!targetContent && !baseContent) {
    return { upstreamChanged: false, localDiffers: false, summary: "Not in upstream (custom file)" };
  }

  if (!targetContent && baseContent) {
    return { upstreamChanged: true, localDiffers: true, summary: "REMOVED in target release" };
  }

  if (targetContent && !baseContent) {
    return { upstreamChanged: true, localDiffers: true, summary: "NEW in target release" };
  }

  const baseTmp = `/tmp/pai-uc-base-${filePath.replace(/\//g, "_")}`;
  const targetTmp = `/tmp/pai-uc-target-${filePath.replace(/\//g, "_")}`;

  try {
    writeFileSync(baseTmp, baseContent!);
    writeFileSync(targetTmp, targetContent!);

    const upstream = diffTwoFiles(baseTmp, targetTmp);
    const local = diffTwoFiles(localPath, targetTmp);

    const upstreamChanged = upstream.differs;
    const localDiffers = local.differs;

    if (!upstreamChanged && !localDiffers) {
      return { upstreamChanged: false, localDiffers: false, summary: "Identical — no changes needed" };
    }

    if (!upstreamChanged && localDiffers) {
      return { upstreamChanged: false, localDiffers: true, summary: `Upstream unchanged, our patch active (${local.lineCount} local lines differ)` };
    }

    if (upstreamChanged && !localDiffers) {
      return { upstreamChanged: true, localDiffers: false, summary: `Upstream changed ${upstream.lineCount} lines — already matches our version` };
    }

    return { upstreamChanged: true, localDiffers: true, summary: `MERGE NEEDED — upstream changed ${upstream.lineCount} lines, our patch differs by ${local.lineCount} lines` };
  } finally {
    try { unlinkSync(baseTmp); } catch {}
    try { unlinkSync(targetTmp); } catch {}
  }
}

// ─── GitHub issue check ──────────────────────────────────────────────────────

interface IssueStatus {
  state: string;
  closedAt: string | null;
}

function checkIssueStatus(issueNumber: string): IssueStatus | null {
  try {
    const result = execSync(
      `gh issue view ${issueNumber} --repo danielmiessler/Personal_AI_Infrastructure --json state,closedAt 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    ).trim();
    return JSON.parse(result);
  } catch {
    try {
      const result = execSync(
        `gh pr view ${issueNumber} --repo danielmiessler/Personal_AI_Infrastructure --json state,closedAt 2>/dev/null`,
        { encoding: "utf-8", timeout: 10000 }
      ).trim();
      const pr = JSON.parse(result);
      return { state: pr.state, closedAt: pr.closedAt };
    } catch {
      return null;
    }
  }
}

// ─── Classification ──────────────────────────────────────────────────────────

type Classification = "SAFE" | "CONFLICT" | "RETIRE" | "CHECK";

interface FileResult {
  file: string;
  upstreamChanged: boolean;
  localDiffers: boolean;
  summary: string;
}

interface PatchReport {
  patch: Patch;
  classification: Classification;
  fileResults: FileResult[];
  issueStatus: IssueStatus | null;
  action: string;
}

function classifyPatch(patch: Patch, fileResults: FileResult[], issueStatus: IssueStatus | null): { classification: Classification; action: string } {
  const anyUpstreamChange = fileResults.some((f) => f.upstreamChanged);
  const anyLocalDiff = fileResults.some((f) => f.localDiffers);
  const issueClosed = issueStatus?.state === "CLOSED" || issueStatus?.state === "MERGED";
  const allCustom = fileResults.every((f) => f.summary.includes("custom file") || f.summary.includes("Not in upstream"));

  if (allCustom) {
    return { classification: "SAFE", action: "Keep as-is (custom file, not in upstream)" };
  }

  if (issueClosed && anyUpstreamChange) {
    return { classification: "RETIRE", action: "Issue closed + upstream changed — likely fixed upstream. Take upstream, retire patch" };
  }

  if (issueClosed && !anyUpstreamChange) {
    return { classification: "CHECK", action: "Issue closed but upstream file unchanged — verify fix included elsewhere" };
  }

  if (anyUpstreamChange && anyLocalDiff) {
    return { classification: "CONFLICT", action: "Upstream changed + we have local patches — merge needed" };
  }

  if (anyUpstreamChange && !anyLocalDiff) {
    return { classification: "SAFE", action: "Upstream changed but already matches our version" };
  }

  if (!anyUpstreamChange && anyLocalDiff) {
    return { classification: "SAFE", action: "Upstream unchanged — our patch carries forward cleanly" };
  }

  return { classification: "SAFE", action: "No changes needed" };
}

// ─── Backup ──────────────────────────────────────────────────────────────────

function createBackup(version: string): string | null {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const backupPath = `${PAI_DIR}-backup-pre-${version.replace(/\./g, "")}-${date}`;

  if (existsSync(backupPath)) {
    console.error(`⚠ Backup already exists: ${backupPath}`);
    return backupPath;
  }

  try {
    execSync(`rsync -a "${PAI_DIR}/" "${backupPath}/" 2>/dev/null`, { timeout: 120000 });
    return backupPath;
  } catch {
    console.error(`⚠ Backup failed (rsync errors). Trying cp...`);
    try {
      execSync(`cp -r "${PAI_DIR}" "${backupPath}" 2>/dev/null`, { timeout: 120000 });
      return backupPath;
    } catch {
      console.error(`✗ Backup failed completely`);
      return null;
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  // 1. Validate repo
  if (!existsSync(repoPath)) {
    console.error(`✗ PAI repo not found at: ${repoPath}`);
    console.error(`  Set PAI_REPO env var or use --repo flag`);
    process.exit(1);
  }

  // 2. Fetch tags and detect versions
  console.error(`Fetching upstream tags...`);
  fetchUpstream();

  const allTags = (gitCmd("git tag -l 'v[0-9]*' --sort=-version:refname") || "").split("\n").filter(Boolean);
  const targetIdx = allTags.indexOf(targetVersion);

  if (targetIdx === -1) {
    console.error(`✗ Version tag ${targetVersion} not found. Available version tags:`);
    console.error(allTags.join("\n") || "none");
    process.exit(1);
  }
  const baseVersion = targetIdx >= 0 && targetIdx + 1 < allTags.length ? allTags[targetIdx + 1] : allTags[allTags.length - 1] || "unknown";

  // 4. Parse LOCAL_PATCHES.md
  const localPatchesPath = join(PAI_DIR, "LOCAL_PATCHES.md");
  if (!existsSync(localPatchesPath)) {
    console.error(`✗ LOCAL_PATCHES.md not found at: ${localPatchesPath}`);
    console.error(`  Copy the template: cp Tools/templates/LOCAL_PATCHES-TEMPLATE.md ${localPatchesPath}`);
    process.exit(1);
  }

  const patchesContent = readFileSync(localPatchesPath, "utf-8");
  const activePatches = parseLocalPatches(patchesContent);

  if (activePatches.length === 0) {
    console.log(`No active patches found. Upgrade should be straightforward.`);
    process.exit(0);
  }

  // 5. Backup if requested
  let backupPath: string | null = null;
  if (doBackup) {
    console.error(`Creating backup...`);
    backupPath = createBackup(targetVersion);
  }

  // 6. Analyze each patch
  const reports: PatchReport[] = [];

  for (const patch of activePatches) {
    const fileResults: FileResult[] = patch.files.map((file) => {
      const result = diffPatchedFile(targetVersion, file, baseVersion);
      return { file, ...result };
    });

    let issueStatus: IssueStatus | null = null;
    if (!skipGh && patch.issueNumber) {
      issueStatus = checkIssueStatus(patch.issueNumber);
    }

    const { classification, action } = classifyPatch(patch, fileResults, issueStatus);

    reports.push({ patch, classification, fileResults, issueStatus, action });
  }

  // 7. Output report
  const counts = { SAFE: 0, CONFLICT: 0, RETIRE: 0, CHECK: 0 };
  reports.forEach((r) => counts[r.classification]++);

  console.log(`\n═══ PAI Upgrade Check: ${baseVersion} → ${targetVersion} ═══════════\n`);
  console.log(`Active patches: ${activePatches.length}`);
  console.log(`Classification: ${counts.CONFLICT} CONFLICT, ${counts.RETIRE} RETIRE, ${counts.CHECK} CHECK, ${counts.SAFE} SAFE\n`);

  for (const report of reports) {
    const icon = { SAFE: "✓", CONFLICT: "⚠", RETIRE: "↑", CHECK: "?" }[report.classification];
    console.log(`${icon} PATCH #${report.patch.id}: ${report.patch.title} — ${report.classification}`);

    for (const fr of report.fileResults) {
      console.log(`  File: ${fr.file} — ${fr.summary}`);
    }

    if (report.issueStatus) {
      console.log(`  Issue: #${report.patch.issueNumber} — ${report.issueStatus.state}`);
    }

    console.log(`  Action: ${report.action}`);
    console.log();
  }

  if (backupPath) {
    console.log(`Backup: ${backupPath}`);
  }

  console.log(`───────────────────────────────────────────────────────────────────────`);
  console.log(`Next: Review CONFLICT patches. For each, decide merge strategy.`);
  console.log(`      RETIRE patches can be replaced with upstream versions directly.`);
  console.log(`      SAFE patches need no action during upgrade.`);
}

main();
