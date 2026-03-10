/**
 * learning-readback.ts - Close the learning loop by reading learnings back into context
 *
 * PURPOSE:
 * The PAI learning system writes extensively (8,400+ files across 5 hooks) but
 * previously had no readback mechanism. This library provides fast, compact
 * readers that LoadContext.hook.ts calls at session start to inject accumulated
 * knowledge back into the model's context.
 *
 * FUNCTIONS:
 * - loadLearningDigest()  — Recent learning signals (ALGORITHM + SYSTEM)
 * - loadWisdomFrames()    — Crystallized behavioral patterns (WISDOM/FRAMES)
 * - loadFailurePatterns() — Recent failure insights (FAILURES)
 * - loadSignalTrends()    — Performance metrics from learning-cache.sh
 *
 * PERFORMANCE:
 * Each function reads a small number of pre-existing files (<10).
 * Total budget: <100ms combined. All reads are synchronous for simplicity.
 *
 * OUTPUT:
 * Each function returns a compact string (<500 chars) or null if no data.
 * Combined output stays under 2000 chars for context injection.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Read the N most recent learning files from a LEARNING subdirectory.
 * Files are named YYYY-MM-DD-HHMMSS_LEARNING_*.md with YAML frontmatter.
 * Extracts the **Feedback:** line and rating for compact display.
 */
function getRecentLearnings(baseDir: string, subdir: string, count: number): string[] {
  const insights: string[] = [];
  const learningDir = join(baseDir, 'MEMORY', 'LEARNING', subdir);
  if (!existsSync(learningDir)) return insights;

  try {
    // Get month dirs sorted descending (newest first)
    const months = readdirSync(learningDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      if (insights.length >= count) break;
      const monthPath = join(learningDir, month);

      try {
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        for (const file of files) {
          if (insights.length >= count) break;
          try {
            const content = readFileSync(join(monthPath, file), 'utf-8');
            const feedbackMatch = content.match(/\*\*Feedback:\*\*\s*(.+)/);
            const ratingMatch = content.match(/rating:\s*(\d+)/);
            if (feedbackMatch) {
              const rating = ratingMatch ? ratingMatch[1] : '?';
              const feedback = feedbackMatch[1].substring(0, 80);
              insights.push(`[${rating}/10] ${feedback}`);
            }
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  return insights;
}

/**
 * Load recent learning signals from ALGORITHM and SYSTEM directories.
 * Returns the 3 most recent from each, formatted as a compact bullet list.
 */
export function loadLearningDigest(paiDir: string): string | null {
  const algorithmInsights = getRecentLearnings(paiDir, 'ALGORITHM', 3);
  const systemInsights = getRecentLearnings(paiDir, 'SYSTEM', 3);

  if (algorithmInsights.length === 0 && systemInsights.length === 0) return null;

  const parts: string[] = ['**Recent Learning Signals:**'];

  if (algorithmInsights.length > 0) {
    parts.push('*Algorithm:*');
    algorithmInsights.forEach(i => parts.push(`  ${i}`));
  }
  if (systemInsights.length > 0) {
    parts.push('*System:*');
    systemInsights.forEach(i => parts.push(`  ${i}`));
  }

  return parts.join('\n');
}

/**
 * Load Wisdom Frame core principles for context injection.
 * Reads all WISDOM/FRAMES/*.md files and extracts principle headers
 * (lines matching "### Name [CRYSTAL: N%]").
 */
export function loadWisdomFrames(paiDir: string): string | null {
  const framesDir = join(paiDir, 'MEMORY', 'WISDOM', 'FRAMES');
  if (!existsSync(framesDir)) return null;

  const principles: string[] = [];

  try {
    const files = readdirSync(framesDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = readFileSync(join(framesDir, file), 'utf-8');
        const domain = file.replace('.md', '');

        // Extract principle headers with CRYSTAL confidence
        const matches = content.matchAll(/^### (.+?) \[CRYSTAL: (\d+)%\]/gm);
        for (const match of matches) {
          const confidence = parseInt(match[2], 10);
          if (confidence >= 85) {
            principles.push(`[${domain}] ${match[1]} (${confidence}%)`);
          }
        }
      } catch { /* skip unreadable frames */ }
    }
  } catch { /* skip if dir scan fails */ }

  if (principles.length === 0) return null;

  return `**Wisdom Frames (high confidence):**\n${principles.map(p => `  ${p}`).join('\n')}`;
}

/**
 * Load recent failure pattern insights.
 * Reads the 5 most recent FAILURES directories and extracts the CONTEXT.md
 * first paragraph for a compact summary of what went wrong.
 */
export function loadFailurePatterns(paiDir: string): string | null {
  const failuresDir = join(paiDir, 'MEMORY', 'LEARNING', 'FAILURES');
  if (!existsSync(failuresDir)) return null;

  const patterns: string[] = [];

  try {
    // Get month dirs sorted descending
    const months = readdirSync(failuresDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      if (patterns.length >= 5) break;
      const monthPath = join(failuresDir, month);

      try {
        // Failure dirs are named timestamp_slug
        const dirs = readdirSync(monthPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .sort()
          .reverse();

        for (const dir of dirs) {
          if (patterns.length >= 5) break;
          const contextPath = join(monthPath, dir, 'CONTEXT.md');
          if (!existsSync(contextPath)) continue;

          try {
            const content = readFileSync(contextPath, 'utf-8');
            // Extract slug as human-readable failure description
            const slug = dir.replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, '').replace(/-/g, ' ');
            // Get date from dir name
            const dateMatch = dir.match(/^(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : '';
            patterns.push(`[${date}] ${slug.substring(0, 70)}`);
          } catch { /* skip unreadable */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  if (patterns.length === 0) return null;

  return `**Recent Failure Patterns (avoid these):**\n${patterns.map(p => `  ${p}`).join('\n')}`;
}

/**
 * Load performance signal trends from the pre-computed learning-cache.sh.
 * Extracts numeric averages and trend direction for a compact status line.
 */
export function loadSignalTrends(paiDir: string): string | null {
  const cachePath = join(paiDir, 'MEMORY', 'STATE', 'learning-cache.sh');
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, 'utf-8');

    // Parse shell variable assignments (key='value' or key=value)
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)='?([^']*)'?$/);
      if (match) vars[match[1]] = match[2];
    }

    const todayAvg = vars.today_avg || '?';
    const weekAvg = vars.week_avg || '?';
    const monthAvg = vars.month_avg || '?';
    const trend = vars.trend || 'stable';
    const totalCount = vars.total_count || '?';
    const dayTrend = vars.day_trend || 'stable';

    const trendEmoji = trend === 'up' ? 'trending up' : trend === 'down' ? 'trending down' : 'stable';

    return `**Performance Signals:** Today: ${todayAvg}/10 | Week: ${weekAvg}/10 | Month: ${monthAvg}/10 | Trend: ${trendEmoji} | Total signals: ${totalCount}`;
  } catch {
    return null;
  }
}

/**
 * Load the most recent synthesis report for context injection.
 * Reads from LEARNING/SYNTHESIS/ monthly directories, returns a compact
 * summary of the latest pattern analysis. Cap at 256 tokens (~1000 chars).
 */
export function loadLatestSynthesis(paiDir: string): string | null {
  const synthesisDir = join(paiDir, 'MEMORY', 'LEARNING', 'SYNTHESIS');
  if (!existsSync(synthesisDir)) return null;

  try {
    // Get month dirs sorted descending (newest first)
    const months = readdirSync(synthesisDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      const monthPath = join(synthesisDir, month);
      try {
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        if (files.length === 0) continue;

        // Read the most recent synthesis file
        const content = readFileSync(join(monthPath, files[0]), 'utf-8');

        // Extract key sections compactly
        const parts: string[] = [];

        // Extract period and avg rating
        const periodMatch = content.match(/\*\*Period:\*\*\s*(.+)/);
        const avgMatch = content.match(/\*\*Average Rating:\*\*\s*(.+)/);
        if (periodMatch) parts.push(`Period: ${periodMatch[1]}`);
        if (avgMatch) parts.push(`Avg: ${avgMatch[1]}`);

        // Extract top issues (most valuable for context)
        const issuesSection = content.match(/## Top Issues\n\n([\s\S]*?)(?=\n##|\n---)/);
        if (issuesSection && !issuesSection[1].includes('No significant issues')) {
          const issues = issuesSection[1].trim().split('\n')
            .filter(l => l.match(/^\d+\./))
            .map(l => l.replace(/^\d+\.\s*/, '').substring(0, 80))
            .slice(0, 3);
          if (issues.length > 0) {
            parts.push('Top issues:');
            issues.forEach(i => parts.push(`  - ${i}`));
          }
        }

        // Extract recommendations
        const recsSection = content.match(/## Recommendations\n\n([\s\S]*?)(?=\n---)/);
        if (recsSection) {
          const recs = recsSection[1].trim().split('\n')
            .filter(l => l.match(/^\d+\./))
            .map(l => l.replace(/^\d+\.\s*/, '').substring(0, 80))
            .slice(0, 3);
          if (recs.length > 0) {
            parts.push('Recommendations:');
            recs.forEach(r => parts.push(`  - ${r}`));
          }
        }

        if (parts.length === 0) return null;

        const result = `**Latest Synthesis:**\n${parts.join('\n')}`;
        // Hard cap at ~1000 chars (256 tokens)
        return result.length > 1000 ? result.substring(0, 997) + '...' : result;
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  return null;
}

/**
 * Load unified behavioral feedback trends for context injection.
 * Reads behavioral-feedback.json state and behavioral-signals.jsonl entries
 * to produce a compact summary of correction + reinforcement system health.
 */
export function loadBehavioralTrends(paiDir: string): string | null {
  const statePath = join(paiDir, 'MEMORY', 'STATE', 'behavioral-feedback.json');
  if (!existsSync(statePath)) return null;

  try {
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    if (!state.enabled) return null;

    const signalsPath = join(paiDir, 'MEMORY', 'LEARNING', 'SIGNALS', 'behavioral-signals.jsonl');
    let correctionTriggers = 0;
    let correctionVerified = 0;
    let avgDelta = 0;
    let ratedCount = 0;
    let reinforcementCount = 0;
    let latestReinforcement: { summary: string; rating: number } | null = null;

    if (existsSync(signalsPath)) {
      const lines = readFileSync(signalsPath, 'utf-8').trim().split('\n').filter(Boolean);
      const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

      // Correction stats
      const corrections = entries.filter((e: any) => e.signal_type === 'correction');
      correctionTriggers = corrections.filter((e: any) => e.phase === 'triggered' && !e.suppressed).length;
      correctionVerified = corrections.filter((e: any) => e.phase === 'verified').length;
      const rated = corrections.filter((e: any) => e.phase === 'rated');
      ratedCount = rated.length;
      if (ratedCount > 0) {
        const deltas = rated.map((e: any) => parseFloat(e.outcome?.delta_from_trigger || '0'));
        avgDelta = deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length;
      }

      // Reinforcement stats
      const reinforcements = entries.filter((e: any) => e.signal_type === 'reinforcement');
      reinforcementCount = reinforcements.length;
      if (reinforcements.length > 0) {
        const latest = reinforcements[reinforcements.length - 1];
        latestReinforcement = {
          summary: latest.behavior_summary || latest.behavior_type || 'unknown',
          rating: latest.rating || 0,
        };
      }
    }

    const parts: string[] = [];

    // Correction section
    const corrStatus = state.correction.enabled ? 'ACTIVE' : `DISABLED (${state.correction.auto_disabled_reason || 'manual'})`;
    if (correctionTriggers > 0) {
      const compliance = Math.round((correctionVerified / correctionTriggers) * 100);
      parts.push(`Corrections: ${correctionTriggers} triggers, ${compliance}% compliance, ${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)} delta, ${corrStatus}`);
    } else {
      parts.push(`Corrections: ${corrStatus}, none yet`);
    }

    // Reinforcement section
    if (reinforcementCount > 0) {
      const topBehaviors = (state.reinforcement?.top_behaviors || []).slice(0, 3);
      const freqs = state.reinforcement?.behavior_frequency || {};
      const topStr = topBehaviors.map((b: string) => `${b} (${freqs[b] || 0})`).join(', ');
      let reinfLine = `Reinforcements: ${reinforcementCount} signals`;
      if (topStr) reinfLine += ` | Top: ${topStr}`;
      if (latestReinforcement) {
        const summary = latestReinforcement.summary.length > 40
          ? latestReinforcement.summary.substring(0, 37) + '...'
          : latestReinforcement.summary;
        reinfLine += ` | Latest: "${summary}" (${latestReinforcement.rating}/10)`;
      }
      parts.push(reinfLine);
    } else {
      parts.push('Reinforcements: none yet');
    }

    return `**Behavioral Feedback:** ${parts.join(' | ')}`;
  } catch {
    return null;
  }
}
