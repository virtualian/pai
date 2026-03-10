#!/usr/bin/env bun
/**
 * UpdateCounts.hook.ts - System Counts Update (SessionEnd)
 *
 * PURPOSE:
 * Updates settings.json counts (skills, hooks, ratings, etc.) and refreshes
 * usage cache from Anthropic API. Runs at session end so banner/statusline
 * have fresh data next session.
 *
 * TRIGGER: SessionEnd
 * PERFORMANCE: ~50ms critical path (counts). API refresh is fire-and-forget.
 *
 * ROOT CAUSE OF PRIOR "Hook cancelled" ERRORS:
 * Claude Code combines a per-hook timeout (600s) with a parent AbortSignal
 * from the session. When the session shuts down, the parent signal fires and
 * aborts any hooks still running — regardless of their individual timeout.
 * The old code awaited readHookInput() (500ms) + refreshUsageCache() (1-3s),
 * keeping the process alive during the window where the parent signal fires.
 * Fix: drain stdin non-blocking, write counts synchronously, fire-and-forget
 * the API refresh, and exit immediately.
 */

import { handleUpdateCounts } from './handlers/UpdateCounts';

// Drain stdin non-blocking — Claude Code pipes JSON to all SessionEnd hooks.
// Using process.stdin.resume() avoids Bun.stdin.stream().getReader() which
// can prevent process.exit(0) from working in some edge cases.
process.stdin.resume();
process.stdin.on('error', () => {});

// Hard timeout safety net.
setTimeout(() => process.exit(0), 3000);

// Graceful shutdown — counts are already persisted before API refresh starts.
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

async function main() {
  try {
    await handleUpdateCounts();
  } catch (err) {
    console.error('[UpdateCounts] Error:', err);
  }
  process.exit(0);
}

main();
