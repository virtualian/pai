# Researcher Agent Architecture: Naming vs. Reality

**Date:** 2026-04-08
**Scope:** PAI Research skill — five researcher agents

---

## Summary

The Research skill's five researcher agents (ClaudeResearcher, GeminiResearcher, GrokResearcher, PerplexityResearcher, CodexResearcher) are all Claude Opus subagents using Claude's built-in WebSearch. Despite their names, none call external LLMs. The names reflect Daniel Miessler's original intent to integrate multiple model APIs — an architecture that was never implemented.

---

## How the Agents Actually Work

All five agents:
- Spawn as Claude Opus subagents via `Agent({ subagent_type: "GeminiResearcher" })` etc.
- Search the web using Claude's built-in **WebSearch** tool
- Have identical tool access: WebSearch, WebFetch, Read, Write, Edit, Grep, Glob
- Differ only in **persona prompting** — analytical style, query decomposition strategy, and communication voice

| Agent | Persona | Analytical Differentiator |
|---|---|---|
| ClaudeResearcher | "Ava Sterling" | Multi-query decomposition, scholarly synthesis |
| GeminiResearcher | "Alex Rivera" | 3-10 query variations from different angles |
| GrokResearcher | "Johannes" | Contrarian, challenges consensus with data |
| PerplexityResearcher | "Ava Chen" | Triple-verification, investigative depth |
| CodexResearcher | "Remy" | Code-focused, follows tangents, TypeScript-first |

---

## How the Names Originated

### v0.3.1 — Original intent was real multi-model (commit `e072bdb`)

Daniel's first research commit (v0.3.1) shipped three agents with a `.env.example` containing API key slots:

> - perplexity-researcher: Fast web research via Perplexity API
> - claude-researcher: Deep research using Claude WebSearch (built-in)
> - gemini-researcher: Multi-perspective research via Google Gemini

The commit message states: *"Users must configure API keys in .env for research agents to work."*

### But even then, all agents were Claude subagents

The original frontmatter for every agent:

```yaml
model: sonnet  # Claude Sonnet — not the named external model
```

All three loaded the same KAI context file, used the same Claude tools, and had identical boilerplate. The external API integrations existed in documentation but not in code.

### v0.3.x — Dead references cleaned up (commit `b3631ae`)

A later fix removed references to commands that never existed:

> *"fix: remove references to non-existent commands in researcher agents"*
> *"These commands were Kai-specific and weren't sanitized for public PAI."*

Agents referenced files like `perform-perplexity-research.md` and `web-research.md` that were never created. The fix had agents use WebSearch/WebFetch directly.

### v4.0.0+ — Names fossilised as personas

Grok and Codex researchers were added in v4.0.0+. By this point the pattern was established: names describe the analytical approach each agent emulates, not the backend. Each agent gained rich backstories, ElevenLabs voice IDs, and distinct methodologies.

---

## Aspirational Capabilities Still Documented

Three agents have documented capabilities that aren't implemented:

| Agent | Claimed Capability | Reality |
|---|---|---|
| GrokResearcher | X/Twitter API for social sentiment | Not wired up |
| PerplexityResearcher | Perplexity Sonar API integration | No workflow exists |
| CodexResearcher | Multi-model consultation (O3, GPT-5-Codex, GPT-4) | `Inference.ts` only calls Claude |

---

## Research Mode Dispatch

| Mode | Agents Launched | Time |
|---|---|---|
| Quick | 1 (Perplexity) | ~10-15s |
| Standard (default) | 3 (Claude + Gemini + Perplexity) | ~15-30s |
| Extensive | 12 (4 types x 3 threads) | ~60-90s |
| Deep Investigation | Iterative, progressive | 3-60 min |

All modes use the same underlying mechanic: parallel Claude Opus subagents with different system prompts, all searching via Claude WebSearch.

---

## Assessment

The naming is misleading but not without value. The diversity of analytical framing (contrarian, academic, multi-perspective, investigative, curiosity-driven) produces genuinely different query decompositions and synthesis styles from the same underlying model. The limitation is that all agents share a single search backend — if Claude WebSearch doesn't surface something, none of them will find it.

Wiring up actual external APIs (Perplexity Sonar, Gemini, Grok) would deliver the multi-source coverage the architecture was designed for. Until then, the agents are behavioural variants, not model variants.
