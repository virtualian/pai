---
name: Notification
description: Per-channel notification control. USE WHEN notification, notifications, voice on, voice off, mute, unmute, notification status.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Notification/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

---

## Slash Command Interface

This skill implements `/notification` with per-channel toggle control:

```
/notification voice on       # Enable voice (curl) notifications
/notification voice off      # Disable voice notifications — suppresses ALL curl calls
/notification desktop on     # Enable desktop notifications
/notification desktop off    # Disable desktop notifications
/notification status         # Show current notification channel states
/notification all off        # Disable all notification channels
/notification all on         # Enable all notification channels
```

---

## Workflow Routing

**When user requests toggling voice notifications:**
Examples: "/notification voice on", "/notification voice off", "turn off voice", "mute voice", "unmute voice", "disable voice notifications", "enable voice", "silence the curls", "stop voice announcements"
-> **Action:** Read `~/.claude/settings.json`, set `notifications.voice` to `true` or `false`, write back. Confirm the change.
-> **Feedback:** "Voice notifications [enabled/disabled]. Phase announcement curls will [fire normally/be suppressed]."

**When user requests toggling desktop notifications:**
Examples: "/notification desktop on", "/notification desktop off", "turn off desktop", "mute desktop", "disable desktop notifications"
-> **Action:** Read `~/.claude/settings.json`, set `notifications.desktop` to `true` or `false`, write back. Confirm the change.
-> **Feedback:** "Desktop notifications [enabled/disabled]."

**When user requests notification status:**
Examples: "/notification status", "notification status", "what notifications are on", "show notification settings"
-> **Action:** Read `~/.claude/settings.json` and display current state of all notification channels.
-> **Output format:**
```
Notification Channel Status:
  Voice:   [ON/OFF]  — Phase announcement curls
  Desktop: [ON/OFF]  — Desktop alerts
  ntfy:    [ON/OFF]  — Push notifications (mobile)
  Discord: [ON/OFF]  — Discord webhook
```

**When user requests toggling all notifications:**
Examples: "/notification all off", "/notification all on", "mute all", "unmute all", "silence everything", "turn on all notifications"
-> **Action:** Read `~/.claude/settings.json`, set `notifications.voice` and `notifications.desktop` to the requested state, write back. Confirm the change.
-> **Feedback:** "All notification channels [enabled/disabled]."

---

## Settings Location

Notification state is stored in `~/.claude/settings.json` under the `notifications` key:

```json
{
  "notifications": {
    "voice": { "enabled": true },
    "desktop": { "enabled": true },
    "ntfy": { "enabled": true, ... },
    "discord": { "enabled": true, ... },
    ...
  }
}
```

- `voice.enabled` (boolean): Controls phase announcement curl commands. When `false`, VoiceGate.hook.ts blocks all curls to localhost:8888.
- `desktop.enabled` (boolean): Controls desktop notification delivery.

Both boolean format (`"voice": true`) and object format (`"voice": { "enabled": true }`) are supported for backwards compatibility.

Settings persist across sessions automatically since they live in settings.json.

---

## Implementation Details

### Voice Suppression Mechanism

The voice toggle works through `VoiceGate.hook.ts` (PreToolUse hook on Bash):

1. Algorithm emits a `curl -s -X POST http://localhost:8888/notify ...` command
2. VoiceGate intercepts it before execution
3. If `notifications.voice` is `false` in settings.json -> **BLOCK** (curl never executes)
4. If `notifications.voice` is `true` (or missing) -> proceed to subagent check
5. If main session -> **PASS** (curl executes)
6. If subagent -> **BLOCK** (subagent curls always blocked)

This means the Algorithm template's `[VERBATIM]` curl directives remain unchanged. The gating happens at infrastructure level, not prompt level.

### Desktop Suppression

Desktop notifications are sent via macOS `osascript` or notification hooks. When `notifications.desktop` is `false`, notification-sending code should check this setting before firing.

---

## When to Activate This Skill

### Direct Notification Commands
- "/notification voice on/off"
- "/notification desktop on/off"
- "/notification status"
- "/notification all on/off"

### Natural Language Triggers
- "turn off voice notifications"
- "mute the voice", "silence curls"
- "stop announcing phases"
- "enable voice", "unmute"
- "what notification channels are on"
- "show notification settings"
- "disable all notifications"

---

## Related Documentation

- **Notification System:** `~/.claude/skills/PAI/THENOTIFICATIONSYSTEM.md`
- **VoiceGate Hook:** `~/.claude/hooks/VoiceGate.hook.ts`
- **Settings:** `~/.claude/settings.json` → `notifications` section
