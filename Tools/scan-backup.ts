#!/usr/bin/env bun
/**
 * scan-backup.ts — secret-pattern hygiene scan over a backup tree.
 *
 * Loads .pai-protected.json pattern categories (PCRE-friendly via JS RegExp,
 * which natively supports lookahead) plus a generic-prefix list, walks the
 * given backup root, and emits a manifest-style log: per-category hit counts
 * and the file paths (relative to the root) that contained at least one
 * match. Never quotes raw matched content — the log is a count + path
 * surface only.
 *
 * Usage:
 *   bun Tools/scan-backup.ts <backup-root> [--label <name>] [--append <log>]
 *
 * Issue #166 Step 4 / Step 8 hygiene log writer.
 */

import { readFileSync, statSync, readdirSync, appendFileSync, writeFileSync } from "fs";
import { join, relative } from "path";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("usage: bun scan-backup.ts <backup-root> [--label <name>] [--append <log>]");
  process.exit(2);
}
const backupRoot = args[0];
const labelIdx = args.indexOf("--label");
const label = labelIdx !== -1 ? args[labelIdx + 1] : backupRoot;
const appendIdx = args.indexOf("--append");
const appendPath = appendIdx !== -1 ? args[appendIdx + 1] : undefined;

const manifestPath = join(import.meta.dir, "..", ".pai-protected.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const categories: Record<string, { patterns: string[] }> =
  manifest.protected.protected_patterns.categories;

const genericPrefixes: Record<string, RegExp> = {
  "generic_sk_prefix": /\bsk-[A-Za-z0-9_-]{20,}/g,
  "generic_ghp_prefix": /\bghp_[A-Za-z0-9]{20,}/g,
  "generic_xox_prefix": /\bxox[abp]-[A-Za-z0-9-]{10,}/g,
  "generic_AKIA_prefix": /\bAKIA[A-Z0-9]{16}/g,
  "generic_ya29_prefix": /\bya29\.[A-Za-z0-9_-]{10,}/g,
  "generic_pem_block": /-----BEGIN [A-Z ]+PRIVATE KEY-----/g,
};

function compileCategory(patterns: string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const p of patterns) {
    try {
      compiled.push(new RegExp(p, "g"));
    } catch (_e) {
      compiled.push(new RegExp(p.replace(/\(\?[!=][^)]*\)/g, ""), "g"));
    }
  }
  return compiled;
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const MAX_BYTES = 4 * 1024 * 1024;

function walk(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile() && st.size <= MAX_BYTES) out.push(full);
    }
  }
  return out;
}

const files = walk(backupRoot);
const totalSize = (() => {
  try { return parseInt(require("child_process").execSync(`du -sb "${backupRoot}" | awk '{print $1}'`).toString().trim()); }
  catch { return -1; }
})();

interface CatResult { hits: number; files: Set<string> }
const results: Record<string, CatResult> = {};
for (const cat of Object.keys(categories)) results[cat] = { hits: 0, files: new Set() };
for (const cat of Object.keys(genericPrefixes)) results[cat] = { hits: 0, files: new Set() };

const compiledCategories: Record<string, RegExp[]> = {};
for (const [cat, def] of Object.entries(categories)) {
  compiledCategories[cat] = compileCategory(def.patterns);
}

for (const file of files) {
  let content: string;
  try { content = readFileSync(file, "utf8"); }
  catch { continue; }
  const rel = relative(backupRoot, file);
  for (const [cat, regs] of Object.entries(compiledCategories)) {
    for (const r of regs) {
      r.lastIndex = 0;
      const m = content.match(r);
      if (m && m.length) {
        results[cat].hits += m.length;
        results[cat].files.add(rel);
        break;
      }
    }
  }
  for (const [cat, r] of Object.entries(genericPrefixes)) {
    r.lastIndex = 0;
    const m = content.match(r);
    if (m && m.length) {
      results[cat].hits += m.length;
      results[cat].files.add(rel);
    }
  }
}

const lines: string[] = [];
lines.push(`==== scan-backup ${new Date().toISOString()} ====`);
lines.push(`label: ${label}`);
lines.push(`root: ${backupRoot}`);
lines.push(`size_bytes: ${totalSize}`);
lines.push(`files_scanned: ${files.length}`);
lines.push(`note: counts are per-pattern-category; paths are relative to root; raw matched content is NEVER recorded`);
lines.push("");
lines.push("category, hits, files_with_hits");
for (const [cat, res] of Object.entries(results)) {
  lines.push(`${cat}, ${res.hits}, ${res.files.size}`);
}
lines.push("");
lines.push("==== file paths per category (paths only) ====");
for (const [cat, res] of Object.entries(results)) {
  if (res.files.size === 0) continue;
  lines.push(`[${cat}]`);
  const sorted = [...res.files].sort();
  for (const f of sorted) lines.push(`  ${f}`);
}
lines.push("");

const out = lines.join("\n");
if (appendPath) appendFileSync(appendPath, out + "\n");
else writeFileSync("/dev/stdout", out);
