#!/usr/bin/env bun
/**
 * VoiceGate.hook.ts - Voice Notification Gate (PreToolUse)
 *
 * PURPOSE:
 * Controls voice notification delivery via two mechanisms:
 * 1. Per-channel toggle: When notifications.voice is false in settings.json,
 *    ALL voice curls are blocked — zero noise, zero execution.
 * 2. Subagent blocking: When voice is enabled, only the main terminal session
 *    can send voice curls. Subagents are silently blocked.
 *
 * ROOT CAUSE THIS FIXES:
 * - Issue #27: No granular notification control — curls fire unconditionally
 * - Subagent flooding: Spawned agents inherit Algorithm context and fire curls
 *
 * TRIGGER: PreToolUse (matcher: Bash)
 *
 * DECISION LOGIC:
 * 1. Command doesn't contain "localhost:8888" → PASS (not a voice curl)
 * 2. notifications.voice is false in settings.json → BLOCK (user disabled voice)
 * 3. Command contains "localhost:8888" AND is main session → PASS
 * 4. Command contains "localhost:8888" AND is NOT main session → BLOCK
 *
 * PERFORMANCE: <5ms. Fast-path exit for non-voice commands. Settings read
 * is synchronous file I/O but only triggered for voice curls (~7 per session).
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface HookInput {
  tool_name: string;
  tool_input: {
    command?: string;
  };
  session_id: string;
}

function isVoiceEnabled(): boolean {
  // Read notifications.voice from settings.json
  // Supports two formats:
  //   Boolean: { "voice": true }
  //   Object:  { "voice": { "enabled": true } }
  // Default to true (voice enabled) if setting is missing or unreadable
  const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
  const settingsPath = join(paiDir, 'settings.json');
  try {
    if (!existsSync(settingsPath)) return true;
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const voice = settings?.notifications?.voice;
    if (voice === undefined || voice === null) return true; // Missing → enabled
    if (typeof voice === 'boolean') return voice;           // Boolean format
    if (typeof voice === 'object') return voice.enabled !== false; // Object format
    return true; // Unknown format → default enabled
  } catch {
    return true; // Can't read settings → default to enabled
  }
}

function isMainSession(sessionId: string): boolean {
  // Terminal detection: if we're in a recognized terminal, this is a main session.
  // Subagents spawned by Task tool don't inherit terminal environment variables,
  // so their absence indicates a subagent context.
  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram === 'iTerm.app' || termProgram === 'WarpTerminal' ||
      termProgram === 'Alacritty' || termProgram === 'Apple_Terminal' ||
      process.env.ITERM_SESSION_ID) {
    return true; // Running in a recognized terminal → main session
  }

  // Kitty detection via session files (backward-compatible)
  const paiDir = process.env.PAI_DIR || join(homedir(), '.claude');
  const kittySessionsDir = join(paiDir, 'MEMORY', 'STATE', 'kitty-sessions');
  if (!existsSync(kittySessionsDir)) return true; // No session tracking dir → allow
  return existsSync(join(kittySessionsDir, `${sessionId}.json`));
}

async function main() {
  let input: HookInput;
  try {
    const reader = Bun.stdin.stream().getReader();
    let raw = '';
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += new TextDecoder().decode(value, { stream: true });
      }
    })();
    await Promise.race([read, new Promise<void>(r => setTimeout(r, 200))]);
    if (!raw.trim()) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const command = input.tool_input?.command || '';

  // Fast path: not a voice curl → allow immediately
  if (!command.includes('localhost:8888')) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // It's a voice curl — check if voice notifications are enabled
  if (!isVoiceEnabled()) {
    console.log(JSON.stringify({
      decision: "block",
      reason: "Voice notifications are disabled (notifications.voice = false in settings.json). Use /notification voice on to re-enable."
    }));
    return;
  }

  // Voice is enabled — check if main session
  if (isMainSession(input.session_id)) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // Subagent trying to send voice → block silently
  // Return a fake success so the agent thinks it worked and moves on
  console.log(JSON.stringify({
    decision: "block",
    reason: "Voice notifications are only sent from the main session. Subagent voice curls are suppressed."
  }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
