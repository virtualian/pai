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

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { handleVoice } from './handlers/VoiceNotification';
import { getSettings } from './lib/identity';

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
 * Global voice gate: check settings.json notifications.voice.enabled.
 * Defaults to true if the key is absent (preserves existing behavior).
 */
function isVoiceEnabled(): boolean {
  const settings = getSettings();
  return (settings as any).notifications?.voice?.enabled !== false;
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
    console.error('[VoiceCompletion] Voice OFF (notifications.voice.enabled: false)');
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
