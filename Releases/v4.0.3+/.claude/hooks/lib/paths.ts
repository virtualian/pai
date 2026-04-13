/**
 * Centralized Path Resolution
 *
 * Two-root architecture:
 *   - CONFIG root (CLAUDE_CONFIG_DIR): Claude Code config — CC's own settings.json, sessions, projects
 *   - PAI root (PAI_DIR): PAI install — hooks, PAI/Tools, Algorithm, skills, agents, VoiceServer, MEMORY, USER
 *
 * Usage:
 *   import { getConfigDir, getPaiDir, configPath, codePath } from './lib/paths';
 *   codePath('MEMORY', 'STATE', 'work.json')  // ~/.pai/MEMORY/STATE/work.json
 *   codePath('PAI', 'Tools', 'Inference')        // ~/.pai/PAI/Tools/Inference
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Expand shell variables in a path string
 * Supports: $HOME, ${HOME}, ~
 */
export function expandPath(path: string): string {
  const home = homedir();

  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/**
 * Get the CC config directory (expanded)
 * Priority: CLAUDE_CONFIG_DIR env var → ~/.claude
 */
export function getConfigDir(): string {
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;

  if (envConfigDir) {
    return expandPath(envConfigDir);
  }

  return join(homedir(), '.claude');
}

/**
 * Get the PAI code directory (expanded)
 * Priority: PAI_DIR env var (expanded) → ~/.pai
 */
export function getPaiDir(): string {
  const envPaiDir = process.env.PAI_DIR;

  if (envPaiDir) {
    return expandPath(envPaiDir);
  }

  return join(homedir(), '.pai');
}

/**
 * Get a path relative to CONFIG root (hooks, MEMORY, settings, projects)
 */
export function configPath(...segments: string[]): string {
  return join(getConfigDir(), ...segments);
}

/**
 * Get a path relative to PAI code root (PAI/Tools, Algorithm, skills, agents)
 */
export function codePath(...segments: string[]): string {
  return join(getPaiDir(), ...segments);
}

/**
 * Get the settings.json path (lives in CONFIG root)
 */
export function getSettingsPath(): string {
  return join(getConfigDir(), 'settings.json');
}

/**
 * Get the hooks directory (lives in PAI root — PAI's hooks are part of the PAI install)
 */
export function getHooksDir(): string {
  return codePath('hooks');
}

/**
 * Get the skills directory (lives in PAI code root)
 */
export function getSkillsDir(): string {
  return codePath('skills');
}

/**
 * Get the MEMORY directory (lives in PAI code root)
 */
export function getMemoryDir(): string {
  return codePath('MEMORY');
}
