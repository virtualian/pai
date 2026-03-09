#!/usr/bin/env bun

/**
 * UpstreamScan.ts — Automated upstream monitoring for PAI
 *
 * Loads UPSTREAM-DIGEST.json, fetches GitHub activity (issues, PRs, discussions),
 * applies disposition-based filtering, performs basic relevance classification,
 * updates watermarks, and outputs a structured report for LLM evaluation.
 *
 * Adapted from jlacour-git's solution (danielmiessler/Personal_AI_Infrastructure#923).
 *
 * Configuration:
 *   PAI_GITHUB_USER env var or --author flag sets the GitHub username for participation detection.
 *   PAI_DIR env var sets the PAI installation directory (default: ~/.claude).
 *   Relevance keywords can be customized via --keywords-file pointing to a JSON file.
 *
 * Usage:
 *   bun Tools/UpstreamScan.ts
 *   bun Tools/UpstreamScan.ts --author myuser
 *   bun Tools/UpstreamScan.ts --no-gh          # Skip GitHub API calls, just report digest state
 *   bun Tools/UpstreamScan.ts --digest <path>  # Custom digest path
 *   bun Tools/UpstreamScan.ts --patches <path> # Custom LOCAL_PATCHES.md path
 *   bun Tools/UpstreamScan.ts --keywords-file <path> # Custom relevance keywords JSON
 *
 * Output: JSON report to stdout, progress to stderr
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, ".claude");
const REPO = "danielmiessler/Personal_AI_Infrastructure";

// ─── Argument parsing ────────────────────────────────────────────────────────

function flagValue(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const skipGh = hasFlag("no-gh");
const digestPath = flagValue("digest") || join(PAI_DIR, "UPSTREAM-DIGEST.json");
const patchesPath = flagValue("patches") || join(PAI_DIR, "LOCAL_PATCHES.md");
const keywordsFile = flagValue("keywords-file");
const OUR_AUTHOR = flagValue("author") || process.env.PAI_GITHUB_USER || "unknown";

if (OUR_AUTHOR === "unknown") {
  console.error("⚠ No GitHub username configured. Set PAI_GITHUB_USER env var or use --author flag.");
  console.error("  Participation detection will not work without this.");
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Disposition = "new" | "open" | "ignore" | "implemented" | "deferred";

interface DigestItem {
  type: "issue" | "pr" | "discussion";
  title: string;
  lastCommentCount: number;
  lastSeenAt: string;
  status: string;
  relevance?: string;
  author?: string;
  disposition: Disposition;
  note?: string;
  action?: string;
  pr?: number;
  patch?: number;
  weParticipated?: boolean;
}

interface DigestMeta {
  lastScanAt: string | null;
  scanCount: number;
  schema: string;
  description?: string;
  dispositionValues?: Record<string, string>;
  filteringRules?: Record<string, string>;
  lastDispositionUpdate?: string | null;
}

interface Digest {
  meta: DigestMeta;
  items: Record<string, DigestItem>;
}

interface GitHubItem {
  number: number;
  title: string;
  author: string;
  createdAt: string;
  comments: number;
  type: "issue" | "pr" | "discussion";
  state?: string;
  labels?: string[];
  reviews?: number;
  category?: string;
  weParticipated?: boolean;
}

type FilterResult = "NEW" | "PENDING" | "REACTIVATED" | "UNCHANGED";

interface ScanItem {
  number: number;
  title: string;
  author: string;
  type: "issue" | "pr" | "discussion";
  filterResult: FilterResult;
  currentComments: number;
  previousComments: number;
  disposition: Disposition;
  previousDisposition?: Disposition;
  relevanceGuess: string;
  weParticipated?: boolean;
}

interface ScanReport {
  meta: {
    scanTimestamp: string;
    previousScanAt: string | null;
    scanCount: number;
    itemsChecked: number;
    new: number;
    pending: number;
    reactivated: number;
    unchanged: number;
  };
  newItems: ScanItem[];
  pendingItems: ScanItem[];
  reactivatedItems: ScanItem[];
  ourPrs: { number: number; title: string; state: string; comments: number; reviews: number }[];
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

function ghCmd(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 30000 }).trim();
  } catch (err: any) {
    console.error(`⚠ gh command failed: ${cmd.slice(0, 80)}...`);
    return null;
  }
}

function fetchIssues(): GitHubItem[] {
  const raw = ghCmd(`gh issue list --repo ${REPO} --state open --limit 30 --json number,title,createdAt,labels,author,comments`);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw);
    return items.map((i: any) => ({
      number: i.number,
      title: i.title,
      author: i.author?.login || "unknown",
      createdAt: i.createdAt,
      comments: i.comments?.length || 0,
      type: "issue" as const,
      labels: i.labels?.map((l: any) => l.name) || [],
      weParticipated: (i.author?.login || "") === OUR_AUTHOR,
    }));
  } catch {
    console.error("⚠ Failed to parse issues response");
    return [];
  }
}

function fetchPrs(): GitHubItem[] {
  const raw = ghCmd(`gh pr list --repo ${REPO} --state open --limit 30 --json number,title,author,createdAt,labels,comments`);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw);
    return items.map((p: any) => ({
      number: p.number,
      title: p.title,
      author: p.author?.login || "unknown",
      createdAt: p.createdAt,
      comments: p.comments?.length || 0,
      type: "pr" as const,
      labels: p.labels?.map((l: any) => l.name) || [],
      weParticipated: (p.author?.login || "") === OUR_AUTHOR,
    }));
  } catch {
    console.error("⚠ Failed to parse PRs response");
    return [];
  }
}

function fetchOurPrs(): { number: number; title: string; state: string; comments: number; reviews: number }[] {
  if (OUR_AUTHOR === "unknown") return [];
  const raw = ghCmd(`gh pr list --repo ${REPO} --author ${OUR_AUTHOR} --state all --json number,title,state,reviews,comments --limit 10`);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw);
    return items.map((p: any) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      comments: p.comments?.length || 0,
      reviews: p.reviews?.length || 0,
    }));
  } catch {
    console.error("⚠ Failed to parse our PRs response");
    return [];
  }
}

function fetchDiscussions(): GitHubItem[] {
  const query = `{ repository(owner:"danielmiessler", name:"Personal_AI_Infrastructure") { discussions(first:15, orderBy:{field:CREATED_AT, direction:DESC}) { nodes { number title createdAt author { login } category { name } comments(first:20) { totalCount nodes { author { login } replies(first:10) { nodes { author { login } } } } } } } } }`;
  const body = JSON.stringify({ query });
  let raw: string | null;
  try {
    raw = execSync(`gh api graphql --input -`, {
      input: body,
      encoding: "utf-8",
      timeout: 30000,
    }).trim();
  } catch {
    console.error("⚠ gh graphql command failed for discussions");
    raw = null;
  }
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const nodes = data?.data?.repository?.discussions?.nodes || [];
    return nodes.map((d: any) => {
      const allParticipants: string[] = [];
      for (const c of d.comments?.nodes || []) {
        if (c.author?.login) allParticipants.push(c.author.login);
        for (const r of c.replies?.nodes || []) {
          if (r.author?.login) allParticipants.push(r.author.login);
        }
      }
      let replyCount = 0;
      for (const c of d.comments?.nodes || []) {
        replyCount += (c.replies?.nodes || []).length;
      }
      const weParticipated = d.author?.login === OUR_AUTHOR || allParticipants.includes(OUR_AUTHOR);
      return {
        number: d.number,
        title: d.title,
        author: d.author?.login || "unknown",
        createdAt: d.createdAt,
        comments: (d.comments?.totalCount || 0) + replyCount,
        type: "discussion" as const,
        category: d.category?.name,
        weParticipated,
      };
    });
  } catch {
    console.error("⚠ Failed to parse discussions response");
    return [];
  }
}

// ─── Relevance heuristics ────────────────────────────────────────────────────

function loadPatchFiles(): string[] {
  if (!existsSync(patchesPath)) return [];
  const content = readFileSync(patchesPath, "utf-8");
  const files: string[] = [];
  const fileMatches = content.matchAll(/`([^`]+\.\w+)`/g);
  for (const m of fileMatches) {
    const f = m[1];
    if (f.includes("/") || f.endsWith(".ts") || f.endsWith(".sh") || f.endsWith(".md") || f.endsWith(".json")) {
      files.push(f.toLowerCase());
    }
  }
  return [...new Set(files)];
}

// Default relevance keywords — covers common PAI components.
// Override with --keywords-file pointing to a JSON file with the same structure.
const DEFAULT_RELEVANCE_KEYWORDS: Record<string, string> = {
  "algorithm": "affects-us",
  "claude.md": "affects-us",
  "hooks": "affects-us",
  "skills": "affects-us",
  "settings.json": "affects-us",
  "buildclaude": "affects-us",
  "context_routing": "affects-us",
  "inference": "affects-us",
  "upgrade": "affects-us",
  "installer": "affects-us",
  "rating": "affects-us",
  "compact": "affects-us",
  "voice": "affects-us",
  "statusline": "affects-us",
  "linux": "not-relevant",
  "windows": "not-relevant",
  "wsl": "not-relevant",
  "docker": "not-relevant",
};

function loadRelevanceKeywords(): Record<string, string> {
  if (keywordsFile && existsSync(keywordsFile)) {
    try {
      return JSON.parse(readFileSync(keywordsFile, "utf-8"));
    } catch {
      console.error(`⚠ Failed to parse keywords file: ${keywordsFile}, using defaults`);
    }
  }
  return DEFAULT_RELEVANCE_KEYWORDS;
}

const RELEVANCE_KEYWORDS = loadRelevanceKeywords();

function guessRelevance(title: string, patchFiles: string[]): string {
  const lower = title.toLowerCase();

  // Check against our patch file names
  for (const pf of patchFiles) {
    const basename = pf.split("/").pop()?.replace(/\.\w+$/, "").toLowerCase() || "";
    if (basename.length > 3 && lower.includes(basename)) {
      return "already-handled";
    }
  }

  // Check keyword map
  for (const [keyword, relevance] of Object.entries(RELEVANCE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return relevance;
    }
  }

  return "unclassified";
}

// ─── Disposition filtering ───────────────────────────────────────────────────

function filterItem(
  item: GitHubItem,
  digest: Digest,
  patchFiles: string[]
): ScanItem {
  const key = String(item.number);
  const existing = digest.items[key];

  const base: Omit<ScanItem, "filterResult" | "disposition" | "previousDisposition" | "relevanceGuess"> = {
    number: item.number,
    title: item.title,
    author: item.author,
    type: item.type,
    currentComments: item.comments,
    previousComments: existing?.lastCommentCount ?? 0,
    weParticipated: item.weParticipated || item.author === OUR_AUTHOR,
  };

  // Item NOT in digest → NEW
  if (!existing) {
    return {
      ...base,
      filterResult: "NEW",
      disposition: "new",
      relevanceGuess: guessRelevance(item.title, patchFiles),
    };
  }

  // Disposition is new or open → PENDING (always resurface)
  if (existing.disposition === "new" || existing.disposition === "open") {
    return {
      ...base,
      filterResult: "PENDING",
      disposition: existing.disposition,
      relevanceGuess: existing.relevance || guessRelevance(item.title, patchFiles),
    };
  }

  // Decided items with new comments → REACTIVATED
  if (item.comments > existing.lastCommentCount) {
    return {
      ...base,
      filterResult: "REACTIVATED",
      disposition: "open",
      previousDisposition: existing.disposition,
      relevanceGuess: existing.relevance || guessRelevance(item.title, patchFiles),
    };
  }

  // Decided items with no new comments → UNCHANGED
  return {
    ...base,
    filterResult: "UNCHANGED",
    disposition: existing.disposition,
    relevanceGuess: existing.relevance || "unchanged",
  };
}

// ─── Digest update ───────────────────────────────────────────────────────────

function updateDigest(digest: Digest, allItems: GitHubItem[], scanItems: ScanItem[]): Digest {
  const now = new Date().toISOString();
  const updated = structuredClone(digest);

  updated.meta.lastScanAt = now;
  updated.meta.scanCount = (updated.meta.scanCount || 0) + 1;

  for (const ghItem of allItems) {
    const key = String(ghItem.number);
    const scanItem = scanItems.find((s) => s.number === ghItem.number);

    if (!updated.items[key]) {
      updated.items[key] = {
        type: ghItem.type,
        title: ghItem.title,
        lastCommentCount: ghItem.comments,
        lastSeenAt: now,
        status: "open",
        author: ghItem.author,
        disposition: "new",
        relevance: scanItem?.relevanceGuess,
        weParticipated: ghItem.weParticipated || ghItem.author === OUR_AUTHOR,
      };
    } else {
      updated.items[key].lastCommentCount = ghItem.comments;
      updated.items[key].lastSeenAt = now;
      updated.items[key].title = ghItem.title;
      if (ghItem.weParticipated || ghItem.author === OUR_AUTHOR) {
        updated.items[key].weParticipated = true;
      }
      if (scanItem?.filterResult === "REACTIVATED") {
        updated.items[key].disposition = "open";
      }
    }
  }

  return updated;
}

function writeDigestAtomic(digest: Digest, path: string): void {
  const tmpPath = path + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(digest, null, 2) + "\n", "utf-8");
  renameSync(tmpPath, path);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  // 1. Load digest
  if (!existsSync(digestPath)) {
    console.error(`✗ UPSTREAM-DIGEST.json not found at: ${digestPath}`);
    console.error(`  Copy the template: cp Tools/templates/UPSTREAM-DIGEST-TEMPLATE.json ${digestPath}`);
    process.exit(1);
  }

  let digest: Digest;
  try {
    digest = JSON.parse(readFileSync(digestPath, "utf-8"));
  } catch (err) {
    console.error(`✗ Failed to parse digest: ${err}`);
    process.exit(1);
  }

  console.error(`Loaded digest: ${Object.keys(digest.items).length} items, last scan: ${digest.meta.lastScanAt}`);

  // 2. Load patch files for relevance heuristics
  const patchFiles = loadPatchFiles();
  console.error(`Loaded ${patchFiles.length} patch file references for relevance matching`);

  // 3. Fetch GitHub data
  let allGhItems: GitHubItem[] = [];
  let ourPrs: { number: number; title: string; state: string; comments: number; reviews: number }[] = [];

  if (!skipGh) {
    console.error("Fetching GitHub data...");

    const issues = fetchIssues();
    console.error(`  Issues: ${issues.length}`);

    const prs = fetchPrs();
    console.error(`  PRs: ${prs.length}`);

    const discussions = fetchDiscussions();
    console.error(`  Discussions: ${discussions.length}`);

    ourPrs = fetchOurPrs();
    console.error(`  Our PRs: ${ourPrs.length}`);

    allGhItems = [...issues, ...prs, ...discussions];
  } else {
    console.error("Skipping GitHub API (--no-gh)");
    for (const [key, item] of Object.entries(digest.items)) {
      allGhItems.push({
        number: parseInt(key),
        title: item.title,
        author: item.author || "unknown",
        createdAt: item.lastSeenAt,
        comments: item.lastCommentCount,
        type: item.type,
      });
    }
  }

  // 4. Filter items
  const scanItems = allGhItems.map((item) => filterItem(item, digest, patchFiles));

  const newItems = scanItems.filter((s) => s.filterResult === "NEW");
  const pendingItems = scanItems.filter((s) => s.filterResult === "PENDING");
  const reactivatedItems = scanItems.filter((s) => s.filterResult === "REACTIVATED");
  const unchangedItems = scanItems.filter((s) => s.filterResult === "UNCHANGED");

  console.error(`\nFiltering results:`);
  console.error(`  NEW: ${newItems.length} | PENDING: ${pendingItems.length} | REACTIVATED: ${reactivatedItems.length} | UNCHANGED: ${unchangedItems.length}`);

  // 5. Update digest with fresh watermarks
  if (!skipGh) {
    const updatedDigest = updateDigest(digest, allGhItems, scanItems);
    writeDigestAtomic(updatedDigest, digestPath);
    console.error(`\nDigest updated (atomic write)`);
  }

  // 6. Output structured report to stdout
  const report: ScanReport = {
    meta: {
      scanTimestamp: new Date().toISOString(),
      previousScanAt: digest.meta.lastScanAt,
      scanCount: (digest.meta.scanCount || 0) + 1,
      itemsChecked: allGhItems.length,
      new: newItems.length,
      pending: pendingItems.length,
      reactivated: reactivatedItems.length,
      unchanged: unchangedItems.length,
    },
    newItems,
    pendingItems,
    reactivatedItems,
    ourPrs,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
