/**
 * ReflectionCapture.ts — Stop handler for LEARN phase reflection extraction
 *
 * Called by ReflectionCapture.hook.ts after response completes. Extracts Q1/Q2/Q3
 * Algorithm Reflection answers and the LEARNING line from the parsed transcript,
 * writing structured JSONL to algorithm-reflections.jsonl.
 *
 * This feeds MineReflections and AlgorithmUpgrade workflows downstream.
 *
 * v4 ARCHITECTURE:
 * - Individual Stop hook pattern (not StopOrchestrator)
 * - Extracts Algorithm metadata from transcript text (no algorithm-state.ts dependency)
 * - Receives ParsedTranscript from hook wrapper (no duplicate transcript parsing)
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getISOTimestamp } from '../lib/time';
import { paiPath } from '../lib/paths';
import type { ParsedTranscript } from '../../PAI/Tools/TranscriptParser';

const REFLECTIONS_DIR = paiPath('MEMORY', 'LEARNING', 'REFLECTIONS');
const REFLECTIONS_FILE = join(REFLECTIONS_DIR, 'algorithm-reflections.jsonl');

// ── Reflection Extraction ──

interface ReflectionData {
  q1: string;
  q2: string;
  q3: string;
  learning: string;
}

/**
 * Extract a reflection field value from text.
 * Handles both bold and plain formats, multi-line content up to the next section.
 */
function extractField(text: string, pattern: RegExp, stopPatterns: RegExp[]): string {
  const match = text.match(pattern);
  if (!match) return '';

  let content = text.slice(match.index! + match[0].length);

  // Find the earliest stop pattern
  let endIdx = content.length;
  for (const stop of stopPatterns) {
    const stopMatch = content.match(stop);
    if (stopMatch && stopMatch.index !== undefined && stopMatch.index < endIdx) {
      endIdx = stopMatch.index;
    }
  }

  content = content.slice(0, endIdx).trim();

  // Clean up markdown artifacts
  content = content
    .replace(/^\*\*\s*/, '')
    .replace(/\s*\*\*$/, '')
    .replace(/^[""\u201C]|[""\u201D]$/g, '')
    .replace(/\n\s*\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*$/, '')
    .trim();

  return content;
}

function extractReflections(text: string): ReflectionData | null {
  // Must have LEARN phase indicators
  const hasLearnPhase = (text.includes('LEARN') && text.includes('7/7')) ||
    (text.includes('LEARN') && text.includes('━━━'));
  const hasReflections = text.includes('Q1') || text.includes('LEARNING');

  if (!hasLearnPhase) return null;

  // FORMAT DRIFT DETECTION: We know we're in LEARN phase but can't find
  // expected keywords. The Algorithm prompt format likely changed.
  if (!hasReflections) {
    console.error('[ReflectionCapture] FORMAT DRIFT: LEARN phase detected but no Q1/LEARNING keywords found. Algorithm prompt format may have changed — reflections will be lost until regex patterns are updated.');
    return null;
  }

  // Support both formats:
  //   "**Q1 (Self):**"  and  "Q1 — Self:"  and  "**Q1 — Self:**"
  //   Also: "[🧠 What should I have done differently..." (Algorithm v3.5 format)
  const q1Pattern = /\*?\*?Q1\s*(?:[—–-]\s*Self|\(Self\)):?\*?\*?\s*/;
  const q2Pattern = /\*?\*?Q2\s*(?:[—–-]\s*Algorithm|\(Algorithm\)):?\*?\*?\s*/;
  const q3Pattern = /\*?\*?Q3\s*(?:[—–-]\s*(?:AI|Capabilities)|\((?:AI|Capabilities)\)):?\*?\*?\s*/;
  const learningPattern = /(?:🧠\s*)?(?:📝\s*)?\*?\*?LEARNING:?\*?\*?\s*/;

  const q1 = extractField(text, q1Pattern, [q2Pattern, q3Pattern, learningPattern, /━━━/, /🗣️/]);
  const q2 = extractField(text, q2Pattern, [q3Pattern, learningPattern, /━━━/, /🗣️/]);
  const q3 = extractField(text, q3Pattern, [learningPattern, /━━━/, /🗣️/]);
  const learning = extractField(text, learningPattern, [/━━━/, /🗣️/, /^#{1,3}\s/m, /^---$/m]);

  // FORMAT DRIFT DETECTION: Keywords exist but all regex extractions failed.
  // The format around Q1/Q2/Q3 changed (e.g., different delimiters or labels).
  if (!q1 && !q2 && !q3 && !learning) {
    console.error('[ReflectionCapture] FORMAT DRIFT: LEARN phase with Q1/LEARNING keywords found, but regex extraction yielded nothing. Patterns likely need updating for new Algorithm format.');
    return null;
  }

  return { q1, q2, q3, learning };
}

// ── Metadata Extraction (from transcript text, no algorithm-state dependency) ──

interface AlgorithmMetadata {
  effortLevel: string;
  taskDescription: string;
  criteriaCount: number;
  criteriaPassed: number;
  criteriaFailed: number;
}

function extractAlgorithmMetadata(text: string): AlgorithmMetadata {
  // Task description: "🗒️ TASK: ..."
  const taskMatch = text.match(/🗒️\s*TASK:\s*(.+?)(?:\n|$)/);
  const taskDescription = taskMatch?.[1]?.trim() || 'Unknown task';

  // Effort level from multiple patterns
  let effortLevel = 'Standard';
  const effortPatterns = [
    /EFFORT\s*LEVEL:\s*\*?\*?(\w+)\*?\*?/i,
    /\[Selected:\s*(\w+)\s*\(/i,
    /\*\*Selected:\*\*\s*(\w+)/i,
    /💪🏼\s*EFFORT\s*LEVEL:\s*\*?\*?(\w+)\*?\*?/i,
  ];
  for (const pattern of effortPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      effortLevel = match[1];
      break;
    }
  }

  // Criteria counts from progress indicators: "progress: 12/15" or "✅ VERIFICATION" section
  let criteriaCount = 0;
  let criteriaPassed = 0;

  // Try progress line: "progress: N/M" or "Progress: N/M"
  const progressMatch = text.match(/progress:\s*(\d+)\s*\/\s*(\d+)/i);
  if (progressMatch) {
    criteriaPassed = parseInt(progressMatch[1], 10);
    criteriaCount = parseInt(progressMatch[2], 10);
  } else {
    // Count ISC checkboxes
    const checked = (text.match(/- \[x\] ISC-/gi) || []).length;
    const unchecked = (text.match(/- \[ \] ISC-/gi) || []).length;
    criteriaCount = checked + unchecked;
    criteriaPassed = checked;
  }

  const criteriaFailed = criteriaCount - criteriaPassed;

  return { effortLevel, taskDescription, criteriaCount, criteriaPassed, criteriaFailed };
}

// ── Deduplication ──

function isDuplicate(sessionId: string): boolean {
  if (!existsSync(REFLECTIONS_FILE)) return false;

  try {
    const content = readFileSync(REFLECTIONS_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.session_id === sessionId) return true;
      } catch {}
    }
  } catch {}

  return false;
}

// ── Handler ──

export async function handleReflectionCapture(
  parsed: ParsedTranscript,
  sessionId: string,
): Promise<void> {
  // Check for duplicate
  if (isDuplicate(sessionId)) {
    console.error(`[ReflectionCapture] Already captured for session ${sessionId.slice(0, 8)}`);
    return;
  }

  // Extract reflections from the current response text (already parsed by hook wrapper)
  const reflections = extractReflections(parsed.currentResponseText);
  if (!reflections) {
    // No LEARN phase reflections in this response — normal for non-Algorithm runs
    return;
  }

  // Extract metadata from transcript text (no algorithm-state.ts dependency)
  const meta = extractAlgorithmMetadata(parsed.currentResponseText);

  // Build JSONL entry matching the MineReflections expected schema
  const entry = {
    timestamp: getISOTimestamp(),
    session_id: sessionId,
    effort_level: meta.effortLevel,
    task_description: meta.taskDescription,
    criteria_count: meta.criteriaCount,
    criteria_passed: meta.criteriaPassed,
    criteria_failed: meta.criteriaFailed,
    prd_id: null as string | null,
    implied_sentiment: meta.criteriaPassed === meta.criteriaCount && meta.criteriaCount > 0 ? 8 : 6,
    reflection_q1: reflections.q1 || null,
    reflection_q2: reflections.q2 || null,
    reflection_q3: reflections.q3 || null,
    learning: reflections.learning || null,
    within_budget: true,
    source: 'auto-hook',
  };

  // Ensure directory exists
  if (!existsSync(REFLECTIONS_DIR)) {
    mkdirSync(REFLECTIONS_DIR, { recursive: true });
  }

  // Append to JSONL
  appendFileSync(REFLECTIONS_FILE, JSON.stringify(entry) + '\n');
  console.error(`[ReflectionCapture] Captured reflections for "${meta.taskDescription}" (${meta.criteriaPassed}/${meta.criteriaCount} criteria)`);
}
