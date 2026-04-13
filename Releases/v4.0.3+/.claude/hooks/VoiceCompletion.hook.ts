#!/usr/bin/env bun
/**
 * VoiceCompletion.hook.ts — Send completion voice line to TTS server
 *
 * PURPOSE:
 * Extracts the 🗣️ voice line from Claude's response and sends it to
 * the ElevenLabs voice server for spoken playback.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (for voice line extraction)
 *
 * VOICE GATE: Only fires for main terminal sessions (not subagents).
 * Checks for kitty-sessions/{sessionId}.json to determine if main session.
 *
 * HANDLER: handlers/VoiceNotification.ts
 */

import { readFileSync, existsSync } from 'fs';
import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { handleVoice } from './handlers/VoiceNotification';
import { getSettingsPath } from './lib/paths';

/**
 * Voice gate: only main terminal sessions get voice.
 * Subagents spawned via Task tool have CLAUDE_CODE_AGENT_TASK_ID set.
 * The old kitty-sessions file check was unreliable — new sessions
 * had no file and were incorrectly blocked.
 */
function isMainSession(): boolean {
  // Subagents set this env var; main sessions don't
  return !process.env.CLAUDE_CODE_AGENT_TASK_ID;
}

/**
 * Check if voice is globally enabled in settings.json.
 * Returns false if notifications.voice.enabled is explicitly false.
 */
function isVoiceEnabled(): boolean {
  try {
    const settingsPath = getSettingsPath();
    if (!existsSync(settingsPath)) return true;
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    return settings.notifications?.voice?.enabled !== false;
  } catch {
    return true; // Default to enabled on error
  }
}

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  // Voice gate: skip subagent sessions
  if (!isMainSession()) {
    console.error('[VoiceCompletion] Voice OFF (not main session)');
    process.exit(0);
  }

  // Voice gate: skip if globally disabled in settings.json
  if (!isVoiceEnabled()) {
    console.error('[VoiceCompletion] Voice OFF (disabled in settings.json)');
    process.exit(0);
  }

  const parsed = await parseTranscriptFromInput(input);

  try {
    await handleVoice(parsed, input.session_id);
  } catch (err) {
    console.error('[VoiceCompletion] Handler failed:', err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[VoiceCompletion] Fatal:', err);
  process.exit(0);
});
