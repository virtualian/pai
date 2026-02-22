#!/usr/bin/env bun
/**
 * Notify.ts — Self-gating voice notification CLI
 *
 * Replaces the VoiceGate hook + raw curl pattern. All gating logic
 * lives here — no external hook needed.
 *
 * Usage:
 *   bun Notify.ts "Entering the Observe phase"
 *   bun Notify.ts --voice-id <id> "message"
 *
 * Exit behavior:
 *   - Voice disabled in settings.json → exits 0 silently
 *   - Running in subagent context → exits 0 silently
 *   - Voice server unreachable → exits 0 silently (fire-and-forget)
 *   - Success → exits 0
 *
 * Settings contract (same as /notification skill):
 *   notifications.voice: boolean | { enabled: boolean }
 *   daidentity.voiceId: string (default voice)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DEFAULT_VOICE_SERVER = "http://localhost:8888/notify";

// ── Settings ──────────────────────────────────

function getPaiDir(): string {
  const envPaiDir = process.env.PAI_DIR;
  if (envPaiDir) {
    return envPaiDir
      .replace(/^\$HOME(?=\/|$)/, homedir())
      .replace(/^\$\{HOME\}(?=\/|$)/, homedir())
      .replace(/^~(?=\/|$)/, homedir());
  }
  return join(homedir(), ".claude");
}

function readSettings(): Record<string, any> {
  const settingsPath = join(getPaiDir(), "settings.json");
  try {
    if (!existsSync(settingsPath)) return {};
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return {};
  }
}

// ── Gates ─────────────────────────────────────

function isVoiceEnabled(settings: Record<string, any>): boolean {
  const voice = settings?.notifications?.voice;
  if (voice === undefined || voice === null) return true;
  if (typeof voice === "boolean") return voice;
  if (typeof voice === "object") return voice.enabled !== false;
  return true;
}

function isMainSession(): boolean {
  const termProgram = process.env.TERM_PROGRAM;
  if (
    termProgram === "iTerm.app" ||
    termProgram === "WarpTerminal" ||
    termProgram === "Alacritty" ||
    termProgram === "Apple_Terminal" ||
    process.env.ITERM_SESSION_ID
  ) {
    return true;
  }

  // Kitty detection via session files
  const kittySessionsDir = join(
    getPaiDir(),
    "MEMORY",
    "STATE",
    "kitty-sessions"
  );
  if (!existsSync(kittySessionsDir)) return true;

  // If we have a session ID from env, check for session file
  const sessionId = process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    return existsSync(join(kittySessionsDir, `${sessionId}.json`));
  }

  return true; // Default allow if no session tracking
}

// ── Main ──────────────────────────────────────

function getVoiceServerUrl(settings: Record<string, any>): string {
  return settings?.notifications?.voiceServer || DEFAULT_VOICE_SERVER;
}

function getVoiceId(settings: Record<string, any>): string {
  return settings?.daidentity?.voiceId || "21m00Tcm4TlvDq8ikWAM";
}

function parseArgs(): { message: string; voiceId?: string } {
  const args = process.argv.slice(2);
  let voiceId: string | undefined;
  const messageArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--voice-id" && args[i + 1]) {
      voiceId = args[++i];
    } else {
      messageArgs.push(args[i]);
    }
  }

  return { message: messageArgs.join(" "), voiceId };
}

async function main() {
  const { message, voiceId: cliVoiceId } = parseArgs();

  if (!message) {
    process.exit(0);
  }

  const settings = readSettings();

  // Gate 1: Voice disabled in settings
  if (!isVoiceEnabled(settings)) {
    process.exit(0);
  }

  // Gate 2: Subagent suppression
  if (!isMainSession()) {
    process.exit(0);
  }

  // All gates passed — send notification
  const voiceId = cliVoiceId || getVoiceId(settings);
  const serverUrl = getVoiceServerUrl(settings);

  try {
    await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId, message }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Fire and forget — voice server down is not an error
  }
}

main();
