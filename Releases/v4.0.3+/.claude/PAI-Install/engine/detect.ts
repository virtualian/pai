/**
 * PAI Installer v4.0 — System Detection
 * Detects OS, tools, existing PAI installation, and environment.
 * All detection is read-only and non-destructive.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { DetectionResult } from "./types";
import { tryExec } from "./exec";

// Detection probes are short and should fail fast. Historical timeout is 5s;
// every call site in this module passes it explicitly to preserve that bound
// on top of `tryExec`'s 30s default (see engine/exec.ts, GitHub #121).
const DETECT_TIMEOUT_MS = 5000;

function detectOS(): DetectionResult["os"] {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch;

  let version = "";
  let name = "";

  if (platform === "darwin") {
    const swVers = tryExec("sw_vers -productVersion", DETECT_TIMEOUT_MS);
    version = swVers || "";
    name = `macOS ${version}`;
  } else {
    const release = tryExec(
      "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'",
      DETECT_TIMEOUT_MS,
    );
    name = release || "Linux";
    version = tryExec("uname -r", DETECT_TIMEOUT_MS) || "";
  }

  return { platform, arch, version, name };
}

function detectShell(): DetectionResult["shell"] {
  const shellPath = process.env.SHELL || "/bin/sh";
  const shellName = shellPath.split("/").pop() || "sh";
  const version = tryExec(`${shellPath} --version 2>&1 | head -1`, DETECT_TIMEOUT_MS) || "";

  return { name: shellName, version, path: shellPath };
}

function detectTool(
  name: string,
  versionCmd: string
): { installed: boolean; version?: string; path?: string } {
  const path = tryExec(`which ${name}`, DETECT_TIMEOUT_MS);
  if (!path) return { installed: false };

  const versionOutput = tryExec(versionCmd, DETECT_TIMEOUT_MS);
  // Extract version number from output
  const versionMatch = versionOutput?.match(/(\d+\.\d+[\.\d]*)/);
  const version = versionMatch?.[1] || versionOutput || undefined;

  return { installed: true, version, path };
}

function detectExisting(
  home: string,
  paiDir: string,
  configDir: string
): DetectionResult["existing"] {
  const result: DetectionResult["existing"] = {
    paiInstalled: false,
    hasApiKeys: false,
    elevenLabsKeyFound: false,
    backupPaths: [],
  };

  // Check for existing PAI installation
  const settingsPath = join(paiDir, "settings.json");
  if (existsSync(settingsPath)) {
    result.paiInstalled = true;
    result.settingsPath = settingsPath;

    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      result.paiVersion = settings.pai?.version || settings.paiVersion || "unknown";
    } catch {
      result.paiVersion = "unknown";
    }
  }

  // Check for existing PAI skill
  if (existsSync(join(paiDir, "skills", "PAI", "SKILL.md"))) {
    result.paiInstalled = true;
  }

  // Check for API keys in env file
  const envPath = join(configDir, ".env");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      result.elevenLabsKeyFound = envContent.includes("ELEVENLABS_API_KEY=");
      result.hasApiKeys = result.elevenLabsKeyFound;
    } catch {
      // Permission denied or other error
    }
  }

  // Check for backup directories
  const backupPatterns = [
    join(home, ".claude-backup"),
    join(home, ".claude-old"),
    join(home, ".claude-BACKUP"),
  ];
  for (const bp of backupPatterns) {
    if (existsSync(bp)) {
      result.backupPaths.push(bp);
    }
  }

  return result;
}

/**
 * Run full system detection. Safe, read-only, non-destructive.
 */
export function detectSystem(): DetectionResult {
  const home = homedir();
  const paiDir = join(home, ".claude");
  const configDir = process.env.PAI_CONFIG_DIR || join(home, ".config", "PAI");

  return {
    os: detectOS(),
    shell: detectShell(),
    tools: {
      bun: detectTool("bun", "bun --version"),
      git: detectTool("git", "git --version"),
      claude: detectTool("claude", "claude --version 2>&1"),
      node: detectTool("node", "node --version"),
      brew: {
        installed: tryExec("which brew", DETECT_TIMEOUT_MS) !== null,
        path: tryExec("which brew", DETECT_TIMEOUT_MS) || undefined,
      },
    },
    existing: detectExisting(home, paiDir, configDir),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    homeDir: home,
    paiDir,
    configDir,
  };
}

/**
 * Validate an ElevenLabs API key.
 * Uses /v1/voices endpoint (requires only xi-api-key header, no specific scope)
 * instead of /v1/user (requires user_read permission, which many keys lack).
 * Also handles 401 with missing_permissions as "valid key, limited scope" —
 * TTS works fine with a known voice_id even without voices_read permission.
 */
export async function validateElevenLabsKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { valid: true };

    // 401 with missing_permissions means the key IS valid but lacks a specific scope.
    // TTS still works (doesn't need voices_read to use a known voice_id).
    if (res.status === 401) {
      try {
        const body = await res.json();
        if (body?.detail?.status === "missing_permissions") {
          return { valid: true };
        }
      } catch { /* fall through to error */ }
    }

    return { valid: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { valid: false, error: e.message || "Network error" };
  }
}
