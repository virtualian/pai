#!/usr/bin/env bun
/**
 * RatingCapture.hook.ts - Unified Rating & Sentiment Capture (UserPromptSubmit)
 *
 * PURPOSE:
 * Single hook for all rating capture. Handles both explicit ratings (1-10 pattern)
 * and implicit sentiment detection (AI inference).
 *
 * TRIGGER: UserPromptSubmit
 *
 * FLOW:
 * 1. Parse input from stdin
 * 2. Check for explicit rating pattern → if found, write and exit
 * 3. If no explicit rating, run AI sentiment inference (Haiku, ~1s)
 * 4. Write result to ratings.jsonl
 * 5. Capture learnings for low ratings (<6), full failure capture for <=3
 *
 * OUTPUT:
 * - exit(0): Normal completion
 *
 * SIDE EFFECTS:
 * - Writes to: MEMORY/LEARNING/SIGNALS/ratings.jsonl
 * - Writes to: MEMORY/LEARNING/<category>/<YYYY-MM>/*.md (for low ratings)
 * - API call: Haiku inference for implicit sentiment (fast/cheap)
 *
 * PERFORMANCE:
 * - Explicit rating path: <50ms (no inference)
 * - Implicit sentiment path: 0.5-1.5s (Haiku inference)
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import { inference } from '../PAI/Tools/Inference';
import { getIdentity, getPrincipal, getPrincipalName } from './lib/identity';
import { getLearningCategory } from './lib/learning-utils';
import { getISOTimestamp, getPSTComponents } from './lib/time';
import { captureFailure } from '../PAI/Tools/FailureCapture';


// ── Shared Types ──

interface HookInput {
  session_id: string;
  prompt?: string;
  user_prompt?: string;  // Legacy field name
  transcript_path: string;
  hook_event_name: string;
}

interface RatingEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  comment?: string;
  source?: 'implicit' | 'explicit';
  sentiment_summary?: string;
  confidence?: number;
  response_preview?: string;  // Truncated last response that was rated (from cache)
}

// ── Shared Constants ──

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const SIGNALS_DIR = join(BASE_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');
const RATINGS_FILE = join(SIGNALS_DIR, 'ratings.jsonl');
const LAST_RESPONSE_CACHE = join(BASE_DIR, 'MEMORY', 'STATE', 'last-response.txt');
const MIN_PROMPT_LENGTH = 3;
const MIN_CONFIDENCE = 0.5;

// ── Behavioral Feedback Constants ──

const BEHAVIORAL_FEEDBACK_STATE = join(BASE_DIR, 'MEMORY', 'STATE', 'behavioral-feedback.json');
const BEHAVIORAL_SIGNALS_FILE = join(SIGNALS_DIR, 'behavioral-signals.jsonl');
const CORRECTION_CONFIDENCE_THRESHOLD = 0.8;

/**
 * CorrectionMode — Fast-path correction detection.
 *
 * Detects explicit corrections in the user's prompt and emits a
 * system-reminder forcing verification before edits. Runs BEFORE
 * the slow sentiment analysis path.
 *
 * Patterns from council-approved spec (RatingCapture lines 192-195):
 * - CORRECTIONS: "No, I meant..." / "That's not what I said" / "I said X not Y"
 * - BEHAVIORAL CORRECTIONS: "Don't do that" / "Stop doing X" / "Never X"
 * - REPEATED REQUESTS: Having to ask the same thing twice
 *
 * Explicitly excluded (refinements, not corrections):
 * - "Actually, let's try Y" (direction change, not error correction)
 * - "What about X?" (exploration, not correction)
 * - "Can we also..." (addition, not correction)
 */

interface CorrectionDetection {
  matched: boolean;
  confidence: number;
  pattern: 'negation_correction' | 'redirect' | 'behavioral' | 'repeated_request' | null;
  promptPreview: string;
}

type BehaviorType =
  | 'thorough-verification'
  | 'clear-documentation'
  | 'surgical-precision'
  | 'iterative-improvement'
  | 'evidence-based'
  | 'working-output'
  | 'good-communication'
  | 'unclassified';

interface BehavioralSignal {
  timestamp: string;
  session_id: string;
  signal_id: string;
  signal_type: 'correction' | 'reinforcement';
  phase: 'triggered' | 'verified' | 'rated';
  confidence: number;
  pattern_matched?: 'negation_correction' | 'redirect' | 'behavioral' | 'repeated_request';
  suppressed?: boolean;
  suppressed_reason?: string;
  rating?: number;
  rating_source?: 'explicit' | 'implicit';
  behavior_type?: BehaviorType;
  behavior_summary?: string;
  prompt_preview: string;
  response_preview?: string;
  outcome?: { delta_from_trigger: string };
}

interface BehavioralFeedbackState {
  enabled: boolean;
  verbose: boolean;
  correction: {
    enabled: boolean;
    review_period_days: number;
    auto_disabled_at: string | null;
    auto_disabled_reason: string | null;
    lifetime_corrections: number;
    lifetime_false_positives: number;
    review_started_at: string;
    next_review_at: string;
  };
  reinforcement: {
    enabled: boolean;
    lifetime_reinforcements: number;
    behavior_frequency: Record<string, number>;
    top_behaviors: BehaviorType[];
    last_reinforcement_at: string | null;
    saturation_threshold: number;
  };
}

// Correction patterns — high-precision regexes for explicit corrections only
const CORRECTION_PATTERNS: Array<{
  pattern: RegExp;
  type: CorrectionDetection['pattern'];
  confidence: number;
}> = [
  // "No, I meant X" / "No, I said X" / "That's not what I asked"
  { pattern: /^no[,.]?\s+(i\s+(meant|said|asked|wanted)|that'?s?\s+not\s+what)/i, type: 'negation_correction', confidence: 0.92 },
  // "I said X not Y" / "I asked for X not Y"
  { pattern: /i\s+(said|asked\s+for|wanted|meant)\s+.+\s+not\s+/i, type: 'negation_correction', confidence: 0.88 },
  // "That's wrong" / "That's incorrect" / "That's not right" / "That's not what I asked"
  { pattern: /that'?s?\s+(wrong|incorrect|not\s+(right|correct|what\s+i))/i, type: 'negation_correction', confidence: 0.90 },
  // "Don't do that" / "Stop doing X" / "Never do X" / "Don't X"
  { pattern: /^(don'?t|stop|never)\s+(do\w*|add\w*|remov\w*|delet\w*|chang\w*|modif\w*|creat\w*|writ\w*)/i, type: 'behavioral', confidence: 0.85 },
  // "You were supposed to X" / "You should have X"
  { pattern: /you\s+(were\s+supposed|should\s+have|were\s+meant)\s+to/i, type: 'negation_correction', confidence: 0.87 },
  // "This is still broken" / "This is still wrong" / "still not working"
  { pattern: /(still\s+(broken|wrong|not\s+work|failing|happen)|keeps?\s+(happen|break|fail))/i, type: 'repeated_request', confidence: 0.85 },
  // "How many times" / "I keep telling you" / "I already said"
  { pattern: /(how\s+many\s+times|i\s+keep\s+tell|i\s+already\s+(said|told|asked))/i, type: 'repeated_request', confidence: 0.90 },
];

// Refinement exclusion patterns — if these match, it's NOT a correction
const REFINEMENT_PATTERNS: RegExp[] = [
  /^actually,?\s+let'?s?\s+(try|go\s+with|use|switch)/i,
  /^what\s+about\s/i,
  /^can\s+we\s+(also|add|try)/i,
  /^let'?s?\s+(also|try|switch|change\s+to)/i,
  /^(instead|rather),?\s+(let'?s?|can\s+we|how\s+about)/i,
];

// ── ReinforcementMode: Behavior Classification ──

const BEHAVIOR_MARKERS: Array<{
  pattern: RegExp;
  behavior: BehaviorType;
  confidence: number;
}> = [
  { pattern: /✅\s*VERIFY/, behavior: 'thorough-verification', confidence: 0.90 },
  { pattern: /\b(diff|verified|confirmed|checked|tested)\b/i, behavior: 'thorough-verification', confidence: 0.85 },
  { pattern: /\b(report|doc|summary|wrote|documented)\b.*\b(created|saved|written)\b/i, behavior: 'clear-documentation', confidence: 0.80 },
  { pattern: /\b(1-line|single|minimal|targeted|surgical)\b.*\b(fix|change|patch|diff)\b/i, behavior: 'surgical-precision', confidence: 0.85 },
  { pattern: /🔄\s*ITERATION/, behavior: 'iterative-improvement', confidence: 0.85 },
  { pattern: /\b(cited|referenced|linked|source|evidence|API response)\b/i, behavior: 'evidence-based', confidence: 0.80 },
  { pattern: /\b(deployed|running|working|functional|live|posted)\b/i, behavior: 'working-output', confidence: 0.75 },
];

function classifyBehavior(
  responsePreview: string,
  prompt: string,
  comment?: string
): { behavior_type: BehaviorType; behavior_summary: string; confidence: number } {
  const text = [responsePreview, prompt, comment].filter(Boolean).join(' ');

  for (const { pattern, behavior, confidence } of BEHAVIOR_MARKERS) {
    if (pattern.test(text)) {
      return {
        behavior_type: behavior,
        behavior_summary: safeSlice(text, 80),
        confidence,
      };
    }
  }

  return { behavior_type: 'unclassified', behavior_summary: '', confidence: 0.5 };
}

// Track session reinforcement count (in-memory, resets per hook invocation)
let sessionReinforcementCount = 0;

function shouldCaptureReinforcement(
  state: BehavioralFeedbackState,
  behaviorType: BehaviorType,
  confidence: number,
): { capture: boolean; reason?: string } {
  if (!state.enabled || !state.reinforcement.enabled) {
    return { capture: false, reason: 'disabled' };
  }
  if (confidence < 0.7) {
    return { capture: false, reason: 'low_confidence' };
  }
  if (sessionReinforcementCount >= 3) {
    return { capture: false, reason: 'session_cap' };
  }
  const freq = state.reinforcement.behavior_frequency[behaviorType] || 0;
  if (freq >= state.reinforcement.saturation_threshold) {
    return { capture: false, reason: 'saturated' };
  }
  return { capture: true };
}

function generateReinforcementId(): string {
  return generateSignalId('reinf');
}

function updateReinforcementState(state: BehavioralFeedbackState, behaviorType: BehaviorType): void {
  state.reinforcement.lifetime_reinforcements++;
  state.reinforcement.behavior_frequency[behaviorType] =
    (state.reinforcement.behavior_frequency[behaviorType] || 0) + 1;
  state.reinforcement.last_reinforcement_at = getISOTimestamp();

  // Recalculate top_behaviors (sorted by frequency, top 5)
  const sorted = Object.entries(state.reinforcement.behavior_frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type as BehaviorType);
  state.reinforcement.top_behaviors = sorted;

  writeFileSync(BEHAVIORAL_FEEDBACK_STATE, JSON.stringify(state, null, 2), 'utf-8');
}

async function captureReinforcement(
  rating: number,
  source: 'explicit' | 'implicit',
  prompt: string,
  responsePreview: string,
  sessionId: string,
  comment?: string,
): Promise<void> {
  if (rating < 8) return;

  const state = loadBehavioralFeedbackState();
  if (!state?.reinforcement?.enabled) return;

  const classification = classifyBehavior(responsePreview, prompt, comment);

  const guard = shouldCaptureReinforcement(state, classification.behavior_type, classification.confidence);
  if (!guard.capture) {
    console.error(`[ReinforcementMode] Skipped (${guard.reason})`);
    return;
  }

  writeBehavioralSignal({
    timestamp: getISOTimestamp(),
    session_id: sessionId,
    signal_id: generateReinforcementId(),
    signal_type: 'reinforcement',
    phase: 'triggered',
    confidence: classification.confidence,
    rating,
    rating_source: source,
    behavior_type: classification.behavior_type,
    behavior_summary: classification.behavior_summary,
    prompt_preview: safeSlice(prompt.trim(), 60),
    response_preview: safeSlice(responsePreview, 500),
  });

  sessionReinforcementCount++;
  updateReinforcementState(state, classification.behavior_type);

  console.error(
    `[ReinforcementMode] Captured: ${classification.behavior_type} ` +
    `(${classification.confidence}) for rating ${rating}`
  );
}

function detectCorrection(prompt: string): CorrectionDetection {
  const trimmed = prompt.trim();
  const preview = trimmed.length > 60 ? safeSlice(trimmed, 57) + '...' : trimmed;

  // Check refinement exclusions first
  for (const refinement of REFINEMENT_PATTERNS) {
    if (refinement.test(trimmed)) {
      return { matched: false, confidence: 0, pattern: null, promptPreview: preview };
    }
  }

  // Check correction patterns
  for (const { pattern, type, confidence } of CORRECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { matched: true, confidence, pattern: type, promptPreview: preview };
    }
  }

  return { matched: false, confidence: 0, pattern: null, promptPreview: preview };
}

function loadBehavioralFeedbackState(): BehavioralFeedbackState | null {
  try {
    if (!existsSync(BEHAVIORAL_FEEDBACK_STATE)) return null;
    return JSON.parse(readFileSync(BEHAVIORAL_FEEDBACK_STATE, 'utf-8'));
  } catch {
    return null;
  }
}

function checkKillSwitch(): { active: boolean; reason?: string; state?: BehavioralFeedbackState } {
  const state = loadBehavioralFeedbackState();
  if (!state) return { active: false, reason: 'no_state_file' };
  if (!state.enabled || !state.correction.enabled) return { active: false, reason: state.correction.auto_disabled_reason || 'disabled' };

  // Check rolling 20 rated entries for kill-switch
  try {
    if (!existsSync(BEHAVIORAL_SIGNALS_FILE)) return { active: true, state };

    // Tail-read optimization: read only the last ~4KB instead of the entire file.
    // Each JSONL line is ~300 bytes, so 4KB covers ~13 entries — enough for rolling checks.
    const fd = Bun.file(BEHAVIORAL_SIGNALS_FILE);
    const fileSize = fd.size;
    const tailSize = Math.min(fileSize, 4096);
    const buffer = new Uint8Array(tailSize);
    const fh = openSync(BEHAVIORAL_SIGNALS_FILE, 'r');
    readSync(fh, buffer, 0, tailSize, Math.max(0, fileSize - tailSize));
    closeSync(fh);

    const tailContent = new TextDecoder().decode(buffer);
    const lines = tailContent.split('\n').filter(Boolean);
    // First line may be partial if we didn't start at file beginning
    if (fileSize > tailSize && lines.length > 0) lines.shift();

    const entries = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    const rated = entries.filter((e: any) => e.phase === 'rated').slice(-20);

    // Need minimum 5 rated entries for kill-switch to evaluate
    if (rated.length < 5) return { active: true, state };

    // Check rolling average delta
    const deltas = rated.map((e: any) => parseFloat(e.outcome?.delta_from_trigger || '0'));
    const avgDelta = deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length;
    if (avgDelta <= 0) {
      return { active: false, reason: 'killswitch_delta', state };
    }

    // Check consecutive false positives (3 in a row)
    const recentRated = rated.slice(-3);
    if (recentRated.length === 3 && recentRated.every((e: any) => {
      const delta = parseFloat(e.outcome?.delta_from_trigger || '0');
      return delta <= 0;
    })) {
      return { active: false, reason: 'consecutive_false_positives', state };
    }

    return { active: true, state };
  } catch {
    return { active: true, state }; // Fail open on read errors
  }
}

function writeBehavioralSignal(entry: Record<string, unknown>): void {
  mkdirSync(SIGNALS_DIR, { recursive: true });
  appendFileSync(BEHAVIORAL_SIGNALS_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

function generateSignalId(prefix: string): string {
  const { year, month, day, hours, minutes, seconds } = getPSTComponents();
  return `${prefix}_${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function generateCorrectionId(): string {
  return generateSignalId('corr');
}

/**
 * CorrectionMode fast-path — runs BEFORE sentiment analysis.
 * Returns true if a correction was detected (processing continues regardless).
 */
function runCorrectionMode(prompt: string, sessionId: string): boolean {
  const detection = detectCorrection(prompt);

  if (!detection.matched || detection.confidence < CORRECTION_CONFIDENCE_THRESHOLD) {
    // Log suppressed detection if it was close (confidence 0.6-0.79)
    if (detection.matched && detection.confidence >= 0.6) {
      writeBehavioralSignal({
        timestamp: getISOTimestamp(),
        session_id: sessionId,
        signal_id: generateCorrectionId(),
        signal_type: 'correction',
        phase: 'triggered',
        confidence: detection.confidence,
        suppressed: true,
        suppressed_reason: 'below_threshold',
        prompt_preview: detection.promptPreview,
        pattern_matched: detection.pattern,
      });
      console.error(`[CorrectionMode] Suppressed (confidence ${detection.confidence} < ${CORRECTION_CONFIDENCE_THRESHOLD}): "${detection.promptPreview}"`);
    }
    return false;
  }

  // Kill-switch check
  const killSwitch = checkKillSwitch();
  if (!killSwitch.active) {
    writeBehavioralSignal({
      timestamp: getISOTimestamp(),
      session_id: sessionId,
      signal_id: generateCorrectionId(),
      signal_type: 'correction',
      phase: 'triggered',
      confidence: detection.confidence,
      suppressed: true,
      suppressed_reason: killSwitch.reason,
      prompt_preview: detection.promptPreview,
      pattern_matched: detection.pattern,
    });
    console.error(`[CorrectionMode] Suppressed (kill-switch: ${killSwitch.reason}): "${detection.promptPreview}"`);
    return false;
  }

  // EMIT system-reminder — this is the behavioral intervention
  const correctionId = generateCorrectionId();
  console.log(`<system-reminder>
CORRECTION DETECTED — verify before editing. Use Read/Grep to confirm current state before any Edit/Write. Re-read the request carefully.
</system-reminder>`);

  // Log triggered entry
  writeBehavioralSignal({
    timestamp: getISOTimestamp(),
    session_id: sessionId,
    signal_id: correctionId,
    signal_type: 'correction',
    phase: 'triggered',
    confidence: detection.confidence,
    suppressed: false,
    prompt_preview: detection.promptPreview,
    pattern_matched: detection.pattern,
  });

  // Update state file lifetime count (reuse state from kill-switch check)
  try {
    const state = killSwitch.state;
    if (state) {
      state.correction.lifetime_corrections++;
      writeFileSync(BEHAVIORAL_FEEDBACK_STATE, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch {
    console.error('[CorrectionMode] Failed to update state file');
  }

  console.error(`[CorrectionMode] FIRED (${detection.pattern}, confidence ${detection.confidence}): "${detection.promptPreview}"`);
  return true;
}

/**
 * Safely slices a string, ensuring it doesn't split a UTF-16 surrogate pair.
 * If the cut boundary lands on a high surrogate, the incomplete pair is dropped.
 */
function safeSlice(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  const code = str.charCodeAt(maxLen - 1);
  if (code >= 0xD800 && code <= 0xDBFF) {
    return str.slice(0, maxLen - 1);
  }
  return str.slice(0, maxLen);
}

/**
 * Read cached last response written by LastResponseCache.hook.ts.
 * Stop fires before next UserPromptSubmit, so cache is always fresh.
 */
function getLastResponse(): string {
  try {
    if (existsSync(LAST_RESPONSE_CACHE)) return readFileSync(LAST_RESPONSE_CACHE, 'utf-8');
  } catch {}
  return '';
}

// ── Stdin Reader ──

async function readStdinWithTimeout(timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Explicit Rating Detection ──

/**
 * Parse explicit rating pattern from prompt.
 * Matches: "7", "8 - good work", "6: needs work", "9 excellent", "10!"
 * Rejects: "3 items", "5 things to fix", "7th thing"
 */
function parseExplicitRating(prompt: string): { rating: number; comment?: string } | null {
  const trimmed = prompt.trim();
  // Rating must be: number alone, or number followed by whitespace/dash/colon then comment
  // Reject: "10/10", "3.5", "7th", "5x" — number followed by non-separator chars
  const ratingPattern = /^(10|[1-9])(?:\s*[-:]\s*|\s+)?(.*)$/;
  const match = trimmed.match(ratingPattern);
  if (!match) return null;

  const rating = parseInt(match[1], 10);
  const rest = match[2]?.trim() || undefined;

  if (rating < 1 || rating > 10) return null;

  // Reject if the character immediately after the number is not a separator
  // This catches "10/10", "3.5", "7th", "5x", etc.
  const afterNumber = trimmed.slice(match[1].length);
  if (afterNumber.length > 0 && /^[/.\dA-Za-z]/.test(afterNumber)) return null;

  // Reject if comment starts with words indicating a sentence, not a rating
  if (rest) {
    const sentenceStarters = /^(items?|things?|steps?|files?|lines?|bugs?|issues?|errors?|times?|minutes?|hours?|days?|seconds?|percent|%|th\b|st\b|nd\b|rd\b|of\b|in\b|at\b|to\b|the\b|a\b|an\b)/i;
    if (sentenceStarters.test(rest)) return null;
  }

  return { rating, comment: rest };
}

// ── Implicit Sentiment Analysis ──

const PRINCIPAL_NAME = getPrincipal().name;
const ASSISTANT_NAME = getIdentity().name;

const SENTIMENT_SYSTEM_PROMPT = `Analyze ${PRINCIPAL_NAME}'s message for emotional sentiment toward ${ASSISTANT_NAME} (the AI assistant).

CONTEXT: This is a personal AI system. ${PRINCIPAL_NAME} is the ONLY user. Never say "users" - always "${PRINCIPAL_NAME}."
IMPORTANT: Ratings come ONLY from ${PRINCIPAL_NAME}'s messages. ${ASSISTANT_NAME} must NEVER self-rate. If the message being analyzed is from ${ASSISTANT_NAME} (not ${PRINCIPAL_NAME}), return null.

OUTPUT FORMAT (JSON only):
{
  "rating": <1-10 or null>,
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": <0.0-1.0>,
  "summary": "<brief explanation, 10 words max>",
  "detailed_context": "<comprehensive analysis for learning, 100-256 words>"
}

DETAILED_CONTEXT REQUIREMENTS (critical for learning system):
Write 100-256 words covering:
1. What ${PRINCIPAL_NAME} was trying to accomplish
2. What ${ASSISTANT_NAME} did (or failed to do)
3. Why ${PRINCIPAL_NAME} is frustrated/satisfied (the root cause)
4. What specific behavior triggered this reaction
5. What ${ASSISTANT_NAME} should have done differently (for negative) or what worked well (for positive)
6. Any patterns this reveals about ${PRINCIPAL_NAME}'s expectations

This context will be used retroactively to improve ${ASSISTANT_NAME}, so include enough detail that someone reading it months later can understand exactly what went wrong or right.

RATING SCALE:
- 1-2: Strong frustration, anger, disappointment with ${ASSISTANT_NAME}
- 3-4: Mild frustration, dissatisfaction
- 5: Neutral (no strong sentiment)
- 6-7: Satisfaction, approval
- 8-9: Strong approval, impressed
- 10: Extraordinary enthusiasm, blown away

CRITICAL DISTINCTIONS:
- Profanity can indicate EITHER frustration OR excitement
  - "What the fuck?!" + complaint about work = LOW (1-3)
  - "Holy shit, this is amazing!" = HIGH (9-10)
- Context is KEY: Is the emotion directed AT ${ASSISTANT_NAME}'s work?
- Sarcasm: "Oh great, another error" = negative despite "great"

SHORT POSITIVE EXPRESSIONS (CRITICAL — DO NOT UNDER-RATE):
When ${PRINCIPAL_NAME} gives short, direct praise like "great job", "nice work", "well done", "love it", "nailed it", "perfect", "awesome" — these are STRONG APPROVAL (8-9). ${PRINCIPAL_NAME} went out of his way to express satisfaction. Do NOT rate these as 6-7. Short praise = high signal. Rate 8 minimum.

IMPLIED SENTIMENT (CRITICAL — THESE ARE NOT NEUTRAL):
Most of ${PRINCIPAL_NAME}'s feedback is IMPLIED, not explicit. Use CONTEXT to detect these patterns:

Implied NEGATIVE (rate 2-4, never null):
- CORRECTIONS: "No, I meant..." / "That's not what I said" / "I said X not Y" → 3-4
- REPEATED REQUESTS: Having to ask the same thing twice → 2-3 (${ASSISTANT_NAME} failed to listen)
- TERSE REDIRECTS: ${ASSISTANT_NAME} gives long output, ${PRINCIPAL_NAME} responds with short redirect ignoring it → 4
- BEHAVIORAL CORRECTIONS: "Don't do that" / "Stop doing X" / "Never X" → 3 (past behavior was wrong)
- EXASPERATED QUESTIONS: "Why is this still broken?" / "How many times..." / "This is still happening" → 2-3
- SHORT DISMISSALS: "whatever" / "fine" / "just do it" / "never mind" → 3-4
- POINTING OUT OMISSIONS: "What about X?" (when X was obviously required) → 4
- ESCALATING FRUSTRATION: "after 20 attempts" / "I keep telling you" → 1-2

Implied POSITIVE (rate 6-8, never null):
- TRUST SIGNALS: "Alright, fix all of it" / "Go ahead" (after analysis) → 7
- BUILDING ON WORK: "Now also add..." / "Next, do..." (accepting prior result) → 6-7
- ENGAGED FOLLOW-UPS: "What about X?" (exploring, not correcting) → 6
- MOVING FORWARD: Accepting output and immediately giving next task → 6

RULE: If ${PRINCIPAL_NAME}'s message is a RESPONSE to ${ASSISTANT_NAME}'s work (check CONTEXT), it almost always carries sentiment. Pure neutral is RARE in responses. Default to detecting signal, not returning null.

WHEN TO RETURN null FOR RATING:
- Neutral technical questions ("Can you check the logs?")
- Simple commands ("Do it", "Yes", "Continue")
- No emotional indicators present
- Emotion unrelated to ${ASSISTANT_NAME}'s work

EXAMPLES:
${PRINCIPAL_NAME}: "What the fuck, why did you delete my file?"
-> {"rating": 1, "sentiment": "negative", "confidence": 0.95, "summary": "Angry about deleted file", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Oh my god, this is fucking incredible, you nailed it!"
-> {"rating": 10, "sentiment": "positive", "confidence": 0.95, "summary": "Extremely impressed with result", "detailed_context": "..."}

${PRINCIPAL_NAME}: "great job"
-> {"rating": 8, "sentiment": "positive", "confidence": 0.9, "summary": "Direct praise for completed work", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Fix the auth bug"
-> {"rating": null, "sentiment": "neutral", "confidence": 0.9, "summary": "Neutral command, no sentiment", "detailed_context": ""}

${PRINCIPAL_NAME}: "Hmm, that's not quite right"
-> {"rating": 4, "sentiment": "negative", "confidence": 0.6, "summary": "Mild dissatisfaction", "detailed_context": "..."}

${PRINCIPAL_NAME}: "No, I said rename them, not delete them"
-> {"rating": 3, "sentiment": "negative", "confidence": 0.8, "summary": "Correction — assistant misunderstood instruction", "detailed_context": "..."}

${PRINCIPAL_NAME}: "This is still happening after I asked you to fix it"
-> {"rating": 2, "sentiment": "negative", "confidence": 0.9, "summary": "Frustrated — repeated failure on same issue", "detailed_context": "..."}

${PRINCIPAL_NAME}: "Alright, fix all of it"
-> {"rating": 7, "sentiment": "positive", "confidence": 0.7, "summary": "Trusts analysis, approves proceeding", "detailed_context": "..."}

${PRINCIPAL_NAME}: "What about X?" (after ${ASSISTANT_NAME} presented complete work)
-> {"rating": 4, "sentiment": "negative", "confidence": 0.65, "summary": "Pointed out omission in delivered work", "detailed_context": "..."}`;

interface SentimentResult {
  rating: number | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  summary: string;
  detailed_context: string;
}

function getRecentContext(transcriptPath: string, maxTurns: number = 3): string {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';

    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    const turns: { role: string; text: string }[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.message?.content) {
          let text = '';
          if (typeof entry.message.content === 'string') {
            text = entry.message.content;
          } else if (Array.isArray(entry.message.content)) {
            text = entry.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ');
          }
          if (text.trim()) turns.push({ role: 'User', text: safeSlice(text, 200) });
        }
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = typeof entry.message.content === 'string'
            ? entry.message.content
            : Array.isArray(entry.message.content)
              ? entry.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join(' ')
              : '';
          if (text) {
            const summaryMatch = text.match(/SUMMARY:\s*([^\n]+)/i);
            turns.push({ role: 'Assistant', text: summaryMatch ? summaryMatch[1] : safeSlice(text, 150) });
          }
        }
      } catch {}
    }

    const recent = turns.slice(-maxTurns);
    return recent.length > 0 ? recent.map(t => `${t.role}: ${t.text}`).join('\n') : '';
  } catch { return ''; }
}

async function analyzeSentiment(prompt: string, context: string): Promise<SentimentResult | null> {
  const userPrompt = context ? `CONTEXT:\n${context}\n\nCURRENT MESSAGE:\n${prompt}` : prompt;

  const result = await inference({
    systemPrompt: SENTIMENT_SYSTEM_PROMPT,
    userPrompt,
    expectJson: true,
    timeout: 12000,
    level: 'fast',
  });

  if (!result.success || !result.parsed) {
    console.error(`[RatingCapture] Inference failed: ${result.error}`);
    return null;
  }

  return result.parsed as SentimentResult;
}

// ── Shared: Write Rating ──

function writeRating(entry: RatingEntry): void {
  if (!existsSync(SIGNALS_DIR)) mkdirSync(SIGNALS_DIR, { recursive: true });
  appendFileSync(RATINGS_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  const source = entry.source === 'implicit' ? 'implicit' : 'explicit';

  console.error(`[RatingCapture] Wrote ${source} rating ${entry.rating} to ${RATINGS_FILE}`);
}

// ── Shared: Capture Low Rating Learning ──

function captureLowRatingLearning(
  rating: number,
  summaryOrComment: string,
  detailedContext: string,
  source: 'explicit' | 'implicit'
): void {
  if (rating >= 5) return;  // 5 = neutral (no sentiment), only capture actual negatives (<=4)
  if (!detailedContext?.trim()) return;  // Skip if no meaningful context to learn from

  const { year, month, day, hours, minutes, seconds } = getPSTComponents();
  const yearMonth = `${year}-${month}`;
  const category = getLearningCategory(detailedContext, summaryOrComment);
  const learningsDir = join(BASE_DIR, 'MEMORY', 'LEARNING', category, yearMonth);

  if (!existsSync(learningsDir)) mkdirSync(learningsDir, { recursive: true });

  const label = source === 'explicit' ? `low-rating-${rating}` : `sentiment-rating-${rating}`;
  const filename = `${year}-${month}-${day}-${hours}${minutes}${seconds}_LEARNING_${label}.md`;
  const filepath = join(learningsDir, filename);

  const tags = source === 'explicit'
    ? '[low-rating, improvement-opportunity]'
    : '[sentiment-detected, implicit-rating, improvement-opportunity]';

  const content = `---
capture_type: LEARNING
timestamp: ${year}-${month}-${day} ${hours}:${minutes}:${seconds} PST
rating: ${rating}
source: ${source}
auto_captured: true
tags: ${tags}
---

# ${source === 'explicit' ? 'Low Rating' : 'Implicit Low Rating'} Captured: ${rating}/10

**Date:** ${year}-${month}-${day}
**Rating:** ${rating}/10
**Detection Method:** ${source === 'explicit' ? 'Explicit Rating' : 'Sentiment Analysis'}
${summaryOrComment ? `**Feedback:** ${summaryOrComment}` : ''}

---

## Context

${detailedContext || 'No context available'}

---

## Improvement Notes

This response was rated ${rating}/10 by ${getPrincipalName()}. Use this as an improvement opportunity.

---
`;

  writeFileSync(filepath, content, 'utf-8');
  console.error(`[RatingCapture] Captured low ${source} rating learning to ${filepath}`);
}

// ── Main ──

async function main() {
  try {
    console.error('[RatingCapture] Hook started');
    const input = await readStdinWithTimeout();
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt || data.user_prompt || '';

    // ── Path 1: Explicit Rating ──
    const explicitResult = parseExplicitRating(prompt);
    if (explicitResult) {
      console.error(`[RatingCapture] Explicit rating: ${explicitResult.rating}${explicitResult.comment ? ` - ${explicitResult.comment}` : ''}`);

      const cachedResponse = getLastResponse();
      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: explicitResult.rating,
        session_id: data.session_id,
        source: 'explicit' as const,
      };
      if (explicitResult.comment) entry.comment = explicitResult.comment;
      if (cachedResponse) entry.response_preview = safeSlice(cachedResponse, 500);

      writeRating(entry);

      // ReinforcementMode: capture positive explicit ratings
      await captureReinforcement(explicitResult.rating, 'explicit', prompt, cachedResponse || '', data.session_id, explicitResult.comment);

      if (explicitResult.rating < 5) {
        // Read cached last response (written by LastResponseCache.hook.ts on previous Stop event)
        const responseContext = getLastResponse();

        captureLowRatingLearning(explicitResult.rating, explicitResult.comment || '', responseContext, 'explicit');

        if (explicitResult.rating <= 3) {
          try {
            await captureFailure({
              transcriptPath: data.transcript_path,
              rating: explicitResult.rating,
              sentimentSummary: explicitResult.comment || `Explicit low rating: ${explicitResult.rating}/10`,
              detailedContext: responseContext,
              sessionId: data.session_id,
            });
            console.error(`[RatingCapture] Created failure capture for explicit rating ${explicitResult.rating}`);
          } catch (err) {
            console.error(`[RatingCapture] Error creating failure capture: ${err}`);
          }
        }
      }

      process.exit(0);
    }

    // ── CorrectionMode Fast-Path (runs before sentiment, ~5ms) ──
    // Detects explicit corrections and emits system-reminder.
    // Does NOT exit — sentiment analysis continues after this.
    if (prompt.length >= MIN_PROMPT_LENGTH) {
      try {
        runCorrectionMode(prompt, data.session_id);
      } catch (err) {
        console.error(`[CorrectionMode] Error in fast-path: ${err}`);
      }
    }

    // ── Path 2: Implicit Sentiment ──

    if (prompt.length < MIN_PROMPT_LENGTH) {
      console.error('[RatingCapture] Prompt too short for sentiment, exiting');
      process.exit(0);
    }

    // BUG FIX: Filter system-injected text before wasting inference on it
    // These are not {PRINCIPAL.NAME}'s messages — they're system notifications, task completions, etc.
    const SYSTEM_TEXT_PATTERNS = [
      /^<task-notification>/i,
      /^<system-reminder>/i,
      /^This session is being continued from a previous conversation/i,
      /^Please continue the conversation/i,
      /^Note:.*was read before/i,
    ];
    if (SYSTEM_TEXT_PATTERNS.some(re => re.test(prompt.trim()))) {
      console.error('[RatingCapture] System-injected text detected, skipping sentiment analysis');
      process.exit(0);
    }

    // BUG FIX: Positive word fast-path — short praise gets rating 8 directly
    // Prevents inference timeout from dropping positive signals (the "Excellent!" bug)
    const POSITIVE_PRAISE_WORDS = new Set([
      'excellent', 'amazing', 'brilliant', 'fantastic', 'wonderful', 'beautiful',
      'incredible', 'awesome', 'perfect', 'great', 'nice', 'superb', 'outstanding',
      'magnificent', 'stellar', 'phenomenal', 'remarkable', 'terrific', 'splendid',
    ]);
    const POSITIVE_PHRASES = new Set([
      'great job', 'good job', 'nice work', 'well done', 'nice job', 'good work',
      'love it', 'nailed it', 'looks great', 'looks good', 'thats great', 'that works',
    ]);
    const normalizedPrompt = prompt.trim().toLowerCase().replace(/[.!?,'"]/g, '');
    const promptWords = normalizedPrompt.split(/\s+/);
    if (promptWords.length <= 2) {
      if (POSITIVE_PRAISE_WORDS.has(normalizedPrompt) || POSITIVE_PHRASES.has(normalizedPrompt)
          || (promptWords.length === 2 && promptWords.every(w => POSITIVE_PRAISE_WORDS.has(w)))) {
        console.error(`[RatingCapture] Positive praise fast-path: "${prompt.trim()}" → rating 8`);
        const cachedResponse = getLastResponse();
        writeRating({
          timestamp: getISOTimestamp(),
          rating: 8,
          session_id: data.session_id,
          source: 'implicit',
          sentiment_summary: `Direct praise: "${prompt.trim()}"`,
          confidence: 0.95,
          ...(cachedResponse ? { response_preview: safeSlice(cachedResponse, 500) } : {}),
        });

        // ReinforcementMode: capture praise fast-path
        await captureReinforcement(8, 'implicit', prompt, cachedResponse || '', data.session_id);

        process.exit(0);
      }
    }

    // Await sentiment analysis — must complete before process exits
    const context = getRecentContext(data.transcript_path, 6);  // BUG FIX: 6 turns instead of 3
    console.error('[RatingCapture] Running implicit sentiment analysis...');

    try {
      const sentiment = await analyzeSentiment(prompt, context);
      if (!sentiment) {
        console.error('[RatingCapture] Sentiment returned null, exiting');
        process.exit(0);
      }

      // BUG FIX: null means "no sentiment detected" — skip, don't convert to 5
      // Previously null→5 inflated neutral count (60% of all entries were noise)
      if (sentiment.rating === null) {
        console.error('[RatingCapture] Sentiment returned null rating (no sentiment), skipping write');
        process.exit(0);
      }
      if (sentiment.confidence < MIN_CONFIDENCE) {
        console.error(`[RatingCapture] Confidence ${sentiment.confidence} below ${MIN_CONFIDENCE}, skipping`);
        process.exit(0);
      }

      console.error(`[RatingCapture] Implicit: ${sentiment.rating}/10 (conf: ${sentiment.confidence}) - ${sentiment.summary}`);

      const implicitCachedResponse = getLastResponse();
      const entry: RatingEntry = {
        timestamp: getISOTimestamp(),
        rating: sentiment.rating,
        session_id: data.session_id,
        source: 'implicit',
        sentiment_summary: sentiment.summary,
        confidence: sentiment.confidence,
      };
      if (implicitCachedResponse) entry.response_preview = safeSlice(implicitCachedResponse, 500);

      writeRating(entry);

      // ReinforcementMode: capture positive implicit ratings
      await captureReinforcement(sentiment.rating, 'implicit', prompt, implicitCachedResponse || '', data.session_id, undefined);

      if (sentiment.rating < 5) {
        captureLowRatingLearning(
          sentiment.rating,
          sentiment.summary,
          sentiment.detailed_context || '',
          'implicit'
        );

        if (sentiment.rating <= 3) {
          await captureFailure({
            transcriptPath: data.transcript_path,
            rating: sentiment.rating,
            sentimentSummary: sentiment.summary,
            detailedContext: sentiment.detailed_context || '',
            sessionId: data.session_id,
          }).catch((err) => console.error(`[RatingCapture] Failure capture error: ${err}`));
        }
      }
    } catch (err) {
      // BUG FIX: Log failures visibly — write a marker entry so inference failures show up in the data
      console.error(`[RatingCapture] Sentiment error: ${err}`);
      const failedPromptPreview = safeSlice(prompt.trim(), 80);
      console.error(`[RatingCapture] FAILED for prompt: "${failedPromptPreview}"`);
      // Write a visible failure marker so we can track inference reliability
      writeRating({
        timestamp: getISOTimestamp(),
        rating: 5,
        session_id: data.session_id,
        source: 'implicit',
        sentiment_summary: `INFERENCE_FAILED: "${failedPromptPreview}"`,
        confidence: 0,
      });

    }

    process.exit(0);
  } catch (err) {
    console.error(`[RatingCapture] Error: ${err}`);
    process.exit(0);
  }
}

main();
