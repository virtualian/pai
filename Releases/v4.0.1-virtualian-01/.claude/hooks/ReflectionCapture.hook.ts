#!/usr/bin/env bun
/**
 * ReflectionCapture.hook.ts — Capture Algorithm LEARN phase reflections
 *
 * PURPOSE:
 * Extracts Q1/Q2/Q3 reflection answers from the Algorithm's LEARN phase
 * and writes structured JSONL to algorithm-reflections.jsonl. This feeds
 * the MineReflections and AlgorithmUpgrade workflows downstream.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (for LEARN phase extraction)
 *
 * HANDLER: handlers/ReflectionCapture.ts
 */

import { readHookInput, parseTranscriptFromInput } from './lib/hook-io';
import { handleReflectionCapture } from './handlers/ReflectionCapture';

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  const parsed = await parseTranscriptFromInput(input);

  try {
    await handleReflectionCapture(parsed, input.session_id);
  } catch (err) {
    console.error('[ReflectionCapture] Handler failed:', err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[ReflectionCapture] Fatal:', err);
  process.exit(0);
});
