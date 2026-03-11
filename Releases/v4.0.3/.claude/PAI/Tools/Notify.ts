#!/usr/bin/env bun
/**
 * Notify.ts — Self-gating voice notification CLI
 *
 * Reads notifications.voice.enabled from settings.json.
 * If disabled: exits silently (zero stdout, zero stderr).
 * If enabled: POSTs to localhost:8888/notify.
 *
 * Replaces raw curl commands in Algorithm/CLAUDE.md templates.
 * See: Issue #83, #27 (architectural fix: gate at the source)
 *
 * Usage: bun ~/.claude/PAI/Tools/Notify.ts "Entering the Algorithm"
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const message = process.argv[2];
if (!message) process.exit(0);

// Read settings
const settingsPath = join(homedir(), '.claude', 'settings.json');
let voiceEnabled = false;
let voiceId = '';

try {
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    voiceEnabled = settings.notifications?.voice?.enabled === true;
    voiceId = settings.daidentity?.voices?.main?.voiceId || '';
  }
} catch {
  process.exit(0);
}

// Gate: exit silently if voice disabled
if (!voiceEnabled) process.exit(0);

// Subagent gate: background agents don't announce
if (process.env.CLAUDE_CODE_AGENT_TASK_ID) process.exit(0);

// POST to voice server
try {
  await fetch('http://localhost:8888/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      voice_enabled: true,
      ...(voiceId && { voice_id: voiceId }),
    }),
    signal: AbortSignal.timeout(5000),
  });
} catch {
  // Silent fail — voice server may be down
}
