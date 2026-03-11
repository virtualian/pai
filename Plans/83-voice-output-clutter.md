# Plan: Fix Voice Output Clutter When Disabled (#83)

**Branch:** `83-voice-output-clutter`
**Related:** #6, #21, #27, #32, #83

---

## Problem

When `notifications.voice.enabled: false` in settings.json, raw `curl` commands to localhost:8888 still execute and dump JSON responses into the output stream:

```
Bash(curl -s -X POST http://localhost:8888/notify ...)
  {
    "status": "success",
    "message": "Notification sent"
  }
```

This happens because voice notifications are hardcoded as raw curl commands in AI prompt templates. The VoiceServer correctly skips TTS when disabled, but the curl execution itself is the clutter.

## Root Cause

Voice curls are embedded directly in 3 prompt templates that the AI reads and executes literally:

| Source | Location | Curl Count |
|--------|----------|------------|
| Algorithm v3.7.0 | `~/.claude/PAI/Algorithm/v3.7.0.md` | 8 (entry + 7 phases) |
| CLAUDE.md | `~/.claude/CLAUDE.md` (NATIVE mode) | 1 |
| Notification System | `~/.claude/PAI/THENOTIFICATIONSYSTEM.md` | Templates for all skills |

The AI has no mechanism to conditionally skip these — it just executes what the template says.

## Prior Art (from closed issues)

- **#6** — Added `notifications.desktop.enabled` toggle to VoiceServer
- **#21** — Added `notifications.voice.enabled` to settings.json; VoiceServer reads it and gates TTS server-side
- **#27** — Proposed replacing raw curls with self-gating `Notify.ts` CLI; also fixed VoiceGate.hook.ts false positives (hook since removed)
- **#32** — Old standalone `Notify.ts` was replaced with `hooks/lib/notifications.ts` (handles ntfy/push, not voice)

**Key insight from #27:** The gate belongs at the source (the tool that makes the call), not in a hook (external observer pattern-matching commands).

## Proposed Solution: Self-Gating `Notify.ts` CLI

Create `~/.claude/PAI/Tools/Notify.ts` — a lightweight CLI that:

1. Reads `notifications.voice.enabled` from `~/.claude/settings.json`
2. If disabled: **exits silently** (exit 0, zero stdout, zero stderr)
3. If enabled: POSTs to `localhost:8888/notify` with the message
4. Reads `voice_id` from `settings.json` `daidentity.voices.main.voiceId` (no hardcoding)
5. Suppresses all output (the Bash tool call still shows but response is empty)

### Usage

```bash
bun ~/.claude/PAI/Tools/Notify.ts "Entering the Algorithm"
```

### Why this approach

| Approach | Eliminates clutter? | False positive risk? | Maintenance |
|----------|--------------------|--------------------|-------------|
| **Notify.ts CLI (chosen)** | Mostly (empty response) | None | Low — single file |
| PreToolUse hook (VoiceGate) | Yes (blocks command) | Yes (#27 showed this) | High — regex matching |
| Template conditional ("if enabled") | Yes if AI follows | None | High — AI may forget |
| LoadContext injects voice status | Yes if AI follows | None | Medium — template + hook change |

**Notify.ts is the #27 architectural fix.** The gate is at the source, not an observer.

### Residual: Bash tool call still visible

Even with Notify.ts, the Bash tool call line itself shows:
```
Bash(bun ~/.claude/PAI/Tools/Notify.ts "Entering the Observe phase.")
  (empty)
```

This is minimal clutter vs the current 4-line JSON dump. To eliminate it entirely, we'd need the AI to not execute the command at all — which requires **also** adding voice status to LoadContext dynamic context and a conditional in the templates.

**Recommendation:** Start with Notify.ts (catches 90% of clutter). If the residual empty Bash calls still bother you, we add LoadContext injection as Phase 2.

---

## Implementation Steps

### Step 1: Create `~/.claude/PAI/Tools/Notify.ts`

```typescript
#!/usr/bin/env bun
/**
 * Notify.ts — Self-gating voice notification CLI
 *
 * Reads notifications.voice.enabled from settings.json.
 * If disabled: exits silently. If enabled: POSTs to voice server.
 * Replaces raw curl commands in Algorithm/CLAUDE.md templates.
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
    voiceEnabled = settings.notifications?.voice?.enabled !== false
                   && settings.notifications?.voice?.enabled !== undefined;
    voiceId = settings.daidentity?.voices?.main?.voiceId || '';
  }
} catch {
  process.exit(0); // Silent fail
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
```

### Step 2: Update Algorithm v3.7.0.md

Replace all instances of:
```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "MESSAGE", "voice_id": "...", "voice_enabled": true}'
```

With:
```bash
bun ~/.claude/PAI/Tools/Notify.ts "MESSAGE"
```

This affects:
- Line 38-41: Voice announcement template
- Line 136: Algorithm entry voice
- Lines in phase descriptions (OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN)

### Step 3: Update CLAUDE.md

Replace the NATIVE mode voice curl (line 21) with:
```
**Voice:** `bun ~/.claude/PAI/Tools/Notify.ts "Executing using PAI native mode"`
```

### Step 4: Update THENOTIFICATIONSYSTEM.md

Replace curl templates with Notify.ts equivalents. Update the "Copy-Paste Templates" section.

### Step 5: Update VoiceCompletion.hook.ts

Add voice enabled check before calling handler:

```typescript
// At top of main(), after isMainSession() check:
const settings = JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf-8'));
if (settings.notifications?.voice?.enabled === false) {
  console.error('[VoiceCompletion] Voice OFF (disabled in settings.json)');
  process.exit(0);
}
```

This prevents the stop hook from making unnecessary HTTP calls to the voice server.

### Step 6: Verify

- [ ] With voice disabled: zero curl output, zero Notify.ts output
- [ ] With voice enabled: voice plays normally at phase transitions
- [ ] Subagents: no voice regardless of setting
- [ ] VoiceServer health endpoint still reports correct status

---

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/PAI/Tools/Notify.ts` | **NEW** — Self-gating voice CLI |
| `~/.claude/PAI/Algorithm/v3.7.0.md` | Replace raw curls with `bun Notify.ts` |
| `~/.claude/CLAUDE.md` | Replace NATIVE mode curl |
| `~/.claude/PAI/THENOTIFICATIONSYSTEM.md` | Replace template curls |
| `~/.claude/hooks/VoiceCompletion.hook.ts` | Add voice enabled gate |

## Out of Scope

- Bulk updating 150+ skill/agent files that reference localhost:8888 (can be done incrementally as skills are touched)
- Phase 2: LoadContext voice status injection for zero-clutter (only if residual empty Bash calls are a problem)
- Removing VoiceServer's server-side voice gate (still useful as defense-in-depth)
