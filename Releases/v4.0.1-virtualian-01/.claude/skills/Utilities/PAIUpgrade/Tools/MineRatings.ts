#!/usr/bin/env bun

/**
 * MineRatings - Extract behavioral patterns from ratings.jsonl
 *
 * Reads accumulated rating signals (explicit and implicit) and uses
 * Haiku inference to extract recurring behavioral patterns, producing
 * actionable "STOP doing" / "DO MORE of" recommendations.
 *
 * Usage:
 *   bun MineRatings.ts                    # Incremental (since last run)
 *   bun MineRatings.ts --all              # Analyze all entries
 *   bun MineRatings.ts --since 7          # Entries from last 7 days
 *   bun MineRatings.ts --dry-run          # Show what would be analyzed
 *   bun MineRatings.ts --dry-run --all    # Show all entries without analysis
 *
 * Output:
 *   - Score band distribution
 *   - Behavioral patterns extracted via Haiku
 *   - STOP / DO MORE recommendations
 *   - Updates high-water-mark for incremental runs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { inference } from '../../../PAI/Tools/Inference';

// ── Types ──

interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  comment?: string;
  source?: 'implicit' | 'explicit';
  sentiment_summary?: string;
  confidence?: number;
  response_preview?: string;
}

interface HighWaterMark {
  last_analyzed_timestamp: string;
  last_run: string;
  entries_analyzed: number;
}

// ── Paths ──

const BASE_DIR = process.env.PAI_DIR || join(homedir(), '.claude');
const RATINGS_FILE = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS', 'ratings.jsonl');
const STATE_DIR = join(BASE_DIR, 'skills', 'Utilities', 'PAIUpgrade', 'State');
const HWM_FILE = join(STATE_DIR, 'mine-ratings-hwm.json');

// ── High-Water-Mark ──

function readHWM(): HighWaterMark | null {
  try {
    if (existsSync(HWM_FILE)) {
      return JSON.parse(readFileSync(HWM_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function writeHWM(hwm: HighWaterMark): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(HWM_FILE, JSON.stringify(hwm, null, 2) + '\n');
}

// ── Rating Parsing ──

function readRatings(): RatingEntry[] {
  if (!existsSync(RATINGS_FILE)) {
    console.error(`[MineRatings] No ratings file found at ${RATINGS_FILE}`);
    return [];
  }

  const content = readFileSync(RATINGS_FILE, 'utf-8');
  const entries: RatingEntry[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as RatingEntry;
      if (typeof entry.rating === 'number' && entry.timestamp) {
        entries.push(entry);
      }
    } catch {}
  }

  return entries;
}

function filterEntries(
  entries: RatingEntry[],
  opts: { all: boolean; sinceDays?: number }
): RatingEntry[] {
  if (opts.all) return entries;

  if (opts.sinceDays !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.sinceDays);
    const cutoffStr = cutoff.toISOString();
    return entries.filter(e => e.timestamp >= cutoffStr);
  }

  // Incremental: entries after high-water-mark
  const hwm = readHWM();
  if (!hwm) return entries; // First run = analyze all

  return entries.filter(e => e.timestamp > hwm.last_analyzed_timestamp);
}

// ── Score Band Analysis ──

interface ScoreBand {
  label: string;
  range: string;
  entries: RatingEntry[];
}

function groupByBand(entries: RatingEntry[]): ScoreBand[] {
  return [
    { label: 'Critical', range: '1-3', entries: entries.filter(e => e.rating >= 1 && e.rating <= 3) },
    { label: 'Needs Work', range: '4-5', entries: entries.filter(e => e.rating >= 4 && e.rating <= 5) },
    { label: 'Acceptable', range: '6-7', entries: entries.filter(e => e.rating >= 6 && e.rating <= 7) },
    { label: 'Strong', range: '8-10', entries: entries.filter(e => e.rating >= 8 && e.rating <= 10) },
  ];
}

function formatDistribution(bands: ScoreBand[], total: number): string {
  return bands.map(b => {
    const pct = total > 0 ? ((b.entries.length / total) * 100).toFixed(1) : '0';
    return `  ${b.label} (${b.range}): ${b.entries.length} entries (${pct}%)`;
  }).join('\n');
}

// ── Inference ──

function buildAnalysisPrompt(entries: RatingEntry[]): string {
  // Build a condensed representation for the LLM
  const samples: string[] = [];

  // Include all low-rated entries (high signal)
  const lowRated = entries.filter(e => e.rating <= 4);
  for (const e of lowRated.slice(0, 50)) {
    const context = e.sentiment_summary || e.comment || e.response_preview?.slice(0, 100) || 'no context';
    samples.push(`[${e.rating}/10] ${e.source || 'unknown'}: ${context}`);
  }

  // Include a sample of mid-range entries
  const midRated = entries.filter(e => e.rating >= 5 && e.rating <= 7);
  for (const e of midRated.slice(0, 20)) {
    const context = e.sentiment_summary || e.comment || 'no context';
    samples.push(`[${e.rating}/10] ${e.source || 'unknown'}: ${context}`);
  }

  // Include high-rated for positive patterns
  const highRated = entries.filter(e => e.rating >= 8);
  for (const e of highRated.slice(0, 20)) {
    const context = e.sentiment_summary || e.comment || 'no context';
    samples.push(`[${e.rating}/10] ${e.source || 'unknown'}: ${context}`);
  }

  return samples.join('\n');
}

const SYSTEM_PROMPT = `You are analyzing rating signals from a Personal AI system. Each entry has a rating (1-10), source (explicit user rating or implicit sentiment detection), and context about what happened.

Your job: identify RECURRING BEHAVIORAL PATTERNS — what the AI does well and what it does poorly.

Output format (JSON):
{
  "stop_doing": [
    {"pattern": "description of bad pattern", "frequency": "how often seen", "evidence": "specific examples from the data"}
  ],
  "do_more": [
    {"pattern": "description of good pattern", "frequency": "how often seen", "evidence": "specific examples from the data"}
  ],
  "insights": [
    "observation about the data distribution or trends"
  ]
}

Rules:
- Focus on PATTERNS, not individual incidents
- A pattern needs 2+ supporting data points
- Be specific: "Misunderstands file rename vs delete instructions" not "Makes mistakes"
- Filter out noise: entries with "INFERENCE_FAILED" are system errors, skip them
- "implicit" source entries may have lower confidence — weight explicit ratings higher
- Return valid JSON only`;

async function analyzePatterns(entries: RatingEntry[]): Promise<string> {
  const prompt = buildAnalysisPrompt(entries);

  if (!prompt.trim()) {
    return 'No meaningful data to analyze.';
  }

  const result = await inference({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Analyze these ${entries.length} rating signals and extract behavioral patterns:\n\n${prompt}`,
    level: 'fast',
    expectJson: true,
    timeout: 20000,
  });

  if (!result.success) {
    return `Inference failed: ${result.error}`;
  }

  // Format the parsed result
  const data = result.parsed as any;
  const lines: string[] = [];

  if (data.stop_doing?.length) {
    lines.push('\n## STOP Doing\n');
    for (const item of data.stop_doing) {
      lines.push(`- **${item.pattern}** (${item.frequency})`);
      lines.push(`  Evidence: ${item.evidence}`);
    }
  }

  if (data.do_more?.length) {
    lines.push('\n## DO MORE Of\n');
    for (const item of data.do_more) {
      lines.push(`- **${item.pattern}** (${item.frequency})`);
      lines.push(`  Evidence: ${item.evidence}`);
    }
  }

  if (data.insights?.length) {
    lines.push('\n## Insights\n');
    for (const insight of data.insights) {
      lines.push(`- ${insight}`);
    }
  }

  return lines.join('\n');
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  let sinceDays: number | undefined;

  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    sinceDays = parseInt(args[sinceIdx + 1], 10);
    if (isNaN(sinceDays) || sinceDays < 1) {
      console.error('Usage: --since N (N = number of days, must be >= 1)');
      process.exit(1);
    }
  }

  // Read and filter
  const allEntries = readRatings();
  if (allEntries.length === 0) {
    console.log('No ratings found. Nothing to analyze.');
    process.exit(0);
  }

  const entries = filterEntries(allEntries, { all, sinceDays });

  // Header
  const hwm = readHWM();
  const mode = all ? 'ALL' : sinceDays ? `last ${sinceDays} days` : (hwm ? 'incremental' : 'first run (all)');
  console.log(`# MineRatings Report`);
  console.log(`\n**Mode:** ${mode}`);
  console.log(`**Total ratings in file:** ${allEntries.length}`);
  console.log(`**Entries to analyze:** ${entries.length}`);
  if (hwm) {
    console.log(`**Last run:** ${hwm.last_run}`);
    console.log(`**Last analyzed:** ${hwm.last_analyzed_timestamp}`);
  }

  if (entries.length === 0) {
    console.log('\nNo new entries since last run. Use --all to re-analyze everything.');
    process.exit(0);
  }

  // Distribution
  const bands = groupByBand(entries);
  const avg = entries.reduce((s, e) => s + e.rating, 0) / entries.length;
  console.log(`\n## Score Distribution (avg: ${avg.toFixed(1)})\n`);
  console.log(formatDistribution(bands, entries.length));

  // Source breakdown
  const explicit = entries.filter(e => e.source === 'explicit').length;
  const implicit = entries.filter(e => e.source === 'implicit').length;
  console.log(`\n**Sources:** ${explicit} explicit, ${implicit} implicit`);

  // Date range
  const timestamps = entries.map(e => e.timestamp).sort();
  if (timestamps.length > 0) {
    console.log(`**Range:** ${timestamps[0]} to ${timestamps[timestamps.length - 1]}`);
  }

  if (dryRun) {
    console.log('\n---\n[DRY RUN] Would analyze the above entries. Run without --dry-run to execute inference.');
    process.exit(0);
  }

  // Run inference
  console.log('\n---\nRunning pattern analysis via Haiku...\n');
  const analysis = await analyzePatterns(entries);
  console.log(analysis);

  // Update high-water-mark
  const latestTimestamp = timestamps[timestamps.length - 1];
  writeHWM({
    last_analyzed_timestamp: latestTimestamp,
    last_run: new Date().toISOString(),
    entries_analyzed: entries.length,
  });
  console.log(`\n---\nHigh-water-mark updated to ${latestTimestamp}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[MineRatings] Fatal: ${err}`);
    process.exit(1);
  });
}
