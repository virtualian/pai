#!/usr/bin/env bun

/**
 * Mine Ratings - Behavioral Pattern Analysis from Rating Signals
 *
 * Analyzes ratings.jsonl for patterns in user satisfaction to produce
 * actionable STOP / DO MORE behavioral rules.
 *
 * Usage:
 *   bun MineRatings.ts              # Process only new entries (since last HWM)
 *   bun MineRatings.ts --all        # Process all entries, ignore HWM
 *
 * Input:
 *   ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl
 *
 * Output:
 *   Structured report with STOP and DO MORE behavioral patterns,
 *   synthesized via Inference (Sonnet, 300s timeout).
 *
 * State:
 *   HWM (high-water-mark) timestamp stored in state file.
 *   On inference failure, HWM is NOT updated so data gets reprocessed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { inference } from '../../../../PAI/Tools/Inference.ts';

// Types
interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  source: string;
  sentiment_summary: string;
  confidence: number;
  comment?: string;
  response_preview?: string;
}

interface SessionGroup {
  session_id: string;
  entries: RatingEntry[];
  avg_rating: number;
  min_rating: number;
  max_rating: number;
  has_explicit: boolean;
  explicit_comments: string[];
}

interface HWMState {
  last_processed_timestamp: string;
  last_run: string;
  entries_processed: number;
}

// Config
const HOME = homedir();
const RATINGS_FILE = join(HOME, '.claude', 'MEMORY', 'LEARNING', 'SIGNALS', 'ratings.jsonl');
const STATE_DIR = join(HOME, '.claude', 'MEMORY', 'LEARNING', 'SIGNALS');
const HWM_FILE = join(STATE_DIR, 'mine-ratings-hwm.json');

// Parse args
const args = process.argv.slice(2);
const PROCESS_ALL = args.includes('--all');

// --- Utilities ---

function loadHWM(): HWMState | null {
  if (!existsSync(HWM_FILE)) return null;
  try {
    return JSON.parse(readFileSync(HWM_FILE, 'utf-8'));
  } catch {
    console.warn('⚠️ Failed to load HWM state, processing all entries');
    return null;
  }
}

function saveHWM(state: HWMState): void {
  try {
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }
    writeFileSync(HWM_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Failed to save HWM state:', error);
  }
}

function parseRatingsFile(): RatingEntry[] {
  if (!existsSync(RATINGS_FILE)) {
    console.error(`❌ Ratings file not found: ${RATINGS_FILE}`);
    process.exit(1);
  }

  const content = readFileSync(RATINGS_FILE, 'utf-8').trim();
  if (!content) {
    console.log('ℹ️ Ratings file is empty, nothing to process.');
    process.exit(0);
  }

  const entries: RatingEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      console.warn(`⚠️ Skipping malformed line ${i + 1}`);
    }
  }

  return entries;
}

function filterByHWM(entries: RatingEntry[], hwm: HWMState | null): RatingEntry[] {
  if (PROCESS_ALL || !hwm) return entries;

  const cutoff = hwm.last_processed_timestamp;
  return entries.filter(e => e.timestamp > cutoff);
}

function groupBySessions(entries: RatingEntry[]): SessionGroup[] {
  const groups = new Map<string, RatingEntry[]>();

  for (const entry of entries) {
    const sid = entry.session_id;
    if (!groups.has(sid)) groups.set(sid, []);
    groups.get(sid)!.push(entry);
  }

  return Array.from(groups.entries()).map(([session_id, entries]) => {
    const ratings = entries.map(e => e.rating);
    const sum = ratings.reduce((a, b) => a + b, 0);
    const explicitEntries = entries.filter(e => e.source === 'explicit');

    return {
      session_id,
      entries,
      avg_rating: sum / ratings.length,
      min_rating: Math.min(...ratings),
      max_rating: Math.max(...ratings),
      has_explicit: explicitEntries.length > 0,
      explicit_comments: explicitEntries
        .filter(e => e.comment)
        .map(e => e.comment!),
    };
  });
}

function buildAnalysisSummary(
  entries: RatingEntry[],
  sessions: SessionGroup[]
): string {
  const totalEntries = entries.length;
  const totalSessions = sessions.length;

  // Rating distribution
  const distribution: Record<number, number> = {};
  for (const e of entries) {
    distribution[e.rating] = (distribution[e.rating] || 0) + 1;
  }

  // Low-rated entries (<=4) are highest signal
  const lowRated = entries.filter(e => e.rating <= 4);
  const highRated = entries.filter(e => e.rating >= 8);

  // Explicit feedback (highest signal)
  const explicitFeedback = entries.filter(e => e.source === 'explicit');

  // Low-rated session summaries (sentiment clustering)
  const lowSentiments = lowRated.map(e => ({
    rating: e.rating,
    sentiment: e.sentiment_summary,
    comment: e.comment || null,
    preview: e.response_preview || null,
    session_id: e.session_id,
  }));

  // High-rated session summaries
  const highSentiments = highRated.map(e => ({
    rating: e.rating,
    sentiment: e.sentiment_summary,
    comment: e.comment || null,
    session_id: e.session_id,
  }));

  // Sessions sorted by avg rating (worst first)
  const worstSessions = [...sessions]
    .sort((a, b) => a.avg_rating - b.avg_rating)
    .slice(0, 10)
    .map(s => ({
      session_id: s.session_id,
      avg_rating: s.avg_rating.toFixed(1),
      count: s.entries.length,
      explicit_comments: s.explicit_comments,
    }));

  const bestSessions = [...sessions]
    .sort((a, b) => b.avg_rating - a.avg_rating)
    .slice(0, 10)
    .map(s => ({
      session_id: s.session_id,
      avg_rating: s.avg_rating.toFixed(1),
      count: s.entries.length,
      explicit_comments: s.explicit_comments,
    }));

  return JSON.stringify({
    overview: {
      total_entries: totalEntries,
      total_sessions: totalSessions,
      rating_distribution: distribution,
      low_rated_count: lowRated.length,
      high_rated_count: highRated.length,
      explicit_feedback_count: explicitFeedback.length,
    },
    low_rated_signals: lowSentiments,
    high_rated_signals: highSentiments,
    explicit_feedback: explicitFeedback.map(e => ({
      rating: e.rating,
      comment: e.comment,
      sentiment: e.sentiment_summary,
      session_id: e.session_id,
    })),
    worst_sessions: worstSessions,
    best_sessions: bestSessions,
  }, null, 2);
}

async function runInference(systemPrompt: string, userPrompt: string): Promise<{ success: boolean; output: string }> {
  const result = await inference({
    systemPrompt,
    userPrompt,
    level: 'standard',
    timeout: 300000,
  });
  return { success: result.success, output: result.success ? result.output : (result.error || 'Inference failed') };
}

// --- Main ---

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  MineRatings — Behavioral Pattern Analysis');
  console.log('═══════════════════════════════════════════════════');
  console.log();

  // 1. Load HWM state
  const hwm = loadHWM();
  if (hwm && !PROCESS_ALL) {
    console.log(`📍 HWM: Processing entries after ${hwm.last_processed_timestamp}`);
    console.log(`   Last run: ${hwm.last_run} (${hwm.entries_processed} entries)`);
  } else {
    console.log(`📍 Processing ALL entries${PROCESS_ALL ? ' (--all flag)' : ' (no prior state)'}`);
  }
  console.log();

  // 2. Read and parse ratings
  const allEntries = parseRatingsFile();
  console.log(`📊 Loaded ${allEntries.length} total rating entries`);

  // 3. Filter by HWM
  const entries = filterByHWM(allEntries, hwm);
  if (entries.length === 0) {
    console.log('ℹ️ No new entries since last run. Use --all to reprocess everything.');
    process.exit(0);
  }
  console.log(`📋 Processing ${entries.length} entries (${PROCESS_ALL ? 'all' : 'new since HWM'})`);
  console.log();

  // 4. Group by session
  const sessions = groupBySessions(entries);
  console.log(`📁 Grouped into ${sessions.length} sessions`);

  // Quick stats
  const lowCount = entries.filter(e => e.rating <= 4).length;
  const highCount = entries.filter(e => e.rating >= 8).length;
  const explicitCount = entries.filter(e => e.source === 'explicit').length;
  console.log(`   Low (<=4): ${lowCount} | High (>=8): ${highCount} | Explicit: ${explicitCount}`);
  console.log();

  // 5. Build analysis summary for inference
  const analysisSummary = buildAnalysisSummary(entries, sessions);

  // 6. Shell out to Inference
  console.log('🤖 Running inference to synthesize behavioral patterns...');
  console.log();

  const systemPrompt = `You are a behavioral analyst for an AI assistant system. You analyze rating data to identify what behaviors the AI should STOP doing and what it should DO MORE of.

Your output MUST be a structured report with these exact sections:

## STOP — Behaviors to eliminate
List specific behaviors that correlate with low ratings (<=4). Be concrete and actionable.
Each item: "- STOP [specific behavior]: [evidence from data]"

## DO MORE — Behaviors to amplify
List specific behaviors that correlate with high ratings (>=8). Be concrete and actionable.
Each item: "- DO MORE [specific behavior]: [evidence from data]"

## EXPLICIT FEEDBACK — User's own words
Summarize explicit feedback comments, grouped by theme. These are the highest-signal data points.

## SESSION PATTERNS
Identify sessions that went particularly well or poorly and what distinguished them.

## CONFIDENCE NOTES
Note any patterns where confidence scores correlate with rating quality.

Rules:
- Be specific, not generic. "STOP writing long explanations" is better than "STOP being verbose"
- Ground every recommendation in the actual data provided
- Prioritize explicit feedback over inferred patterns
- If data is insufficient for a section, say so honestly
- Low ratings (<=4) are the most valuable signal — analyze them deeply`;

  const userPrompt = `Analyze this rating data and produce a STOP / DO MORE behavioral report:

${analysisSummary}`;

  const result = await runInference(systemPrompt, userPrompt);

  if (!result.success) {
    console.error('❌ Inference failed:', result.output);
    console.error('   HWM NOT updated — data will be reprocessed on next run.');
    process.exit(1);
  }

  // 7. Output the report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  BEHAVIORAL PATTERN REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log(result.output);
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 8. Update HWM only on success
  const maxTimestamp = entries.reduce(
    (max, e) => (e.timestamp > max ? e.timestamp : max),
    entries[0].timestamp
  );

  saveHWM({
    last_processed_timestamp: maxTimestamp,
    last_run: new Date().toISOString(),
    entries_processed: entries.length,
  });

  console.log();
  console.log(`✅ HWM updated to ${maxTimestamp}`);
  console.log(`   Processed ${entries.length} entries across ${sessions.length} sessions`);
}

// Run
main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
