# Council Report: Rule System Reform (Discussion #908)

**Date:** 2026-03-09
**Source:** [danielmiessler/Personal_AI_Infrastructure#908](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/908) by jlacour-git
**Related:** [Gists by jlacour-git](https://gist.github.com/jlacour-git) | [Fork](https://github.com/jlacour-git/Personal_AI_Infrastructure)
**Council Members:** PAI Expert, Prompt Engineer, Cognitive Load Designer, Systems Architect, Status Quo Defender
**Format:** 3-round structured debate (Positions → Responses & Challenges → Synthesis)

---

## Executive Summary

The council evaluated jlacour-git's "Rule System Reform" — a proposal claiming 65% rule token reduction through three frameworks: lateral reclassification, priority hierarchy, and algorithm capability enforcement. The council also evaluated six implementation artifacts (ModeClassifier hook, Complexity Gate, Conditional Algorithm Read, ContextAssembler, LOCAL_PATCHES template, prose compression methodology).

**Verdict: Selective adoption.** The council unanimously rejected 6 of the implementation artifacts as either solving problems we don't have or adding complexity disproportionate to benefit. Three ideas earned consensus support. One remains contested.

| Category | Decision | Vote |
|----------|----------|------|
| Algorithm Critical Rules relocation | **ACCEPT** | 4-1 |
| Walkthrough Test methodology | **ACCEPT** | 4-1 |
| Scenario Test methodology | **ACCEPT** (as concept, not name) | 3-2 |
| Priority Hierarchy preamble | **CONTESTED** | 2 Yes, 2 Conditional, 1 No |
| Lateral Reclassification audit | **CONDITIONAL** | 2 Yes, 1 Conditional, 2 No |
| Conditional Algorithm Read | **SPLIT** | 2 Yes, 1 Conditional, 2 No |
| ModeClassifier hook | **REJECT** | 5-0 |
| ContextAssembler hook | **REJECT** | 5-0 |
| Full prose compression | **REJECT** | 5-0 |
| Capability compression | **REJECT** | 5-0 |
| Complexity Gate | **REJECT** | 4-1 |
| LOCAL_PATCHES template | **REJECT** | 4-1 |

---

## The Proposal

### Problem Statement (jlacour-git's context)

Rule system grew organically to 41 rules across 4 layers, consuming ~8,200 always-loaded tokens. Performance was 3-4/10 on average. Hypothesis: instruction fatigue — rules competing for attention — degrades compliance rather than improving it.

### Three Frameworks

**1. Lateral Reclassification** — Not everything in a steering rules file is a rule. Four types found mixed together: rules (behavioral corrections), conventions (facts/preferences), procedures (multi-step workflows), routing entries (path mappings). Moving non-rules to their proper locations (MEMORY.md, skills, CONTEXT_ROUTING.md) eliminated 7 of 23 USER rules.

**2. Priority Hierarchy** — Trust > Correctness > Quality > Efficiency. Rules grouped by priority level with hierarchy preamble at top and reminder at bottom to counter U-shaped attention curve. When rules conflict, higher-priority rules win.

**3. Algorithm Capability Enforcement** — Selected capabilities become ISC criteria, verified through existing checkbox mechanism. ~250 tokens of guidance replaced with ~60 tokens.

### Implementation Artifacts

- **ModeClassifier hook** — Pattern-matching UserPromptSubmit hook (greetings → MINIMAL, else → ALGORITHM)
- **Complexity Gate** — In CLAUDE.md, before Algorithm read, evaluates if task is genuinely multi-step
- **Conditional Algorithm Read** — First ALGORITHM turn or post-compaction only
- **ContextAssembler** — Three-tier retrieval gate with session-level dedup and token budgeting
- **LOCAL_PATCHES template** — Tracks modifications to SYSTEM files for upgrade safety
- **Prose compression** — Scenario Test + Walkthrough Test + Structural Integrity Check

### Claimed Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Always-loaded tokens | ~8,200 | ~2,900 | -65% |
| With Algorithm | ~13,100 | ~6,600 | -50% |
| Rule count | 41 | 26 | -37% |
| Total prose (all files) | 6,743 words | 4,888 words | -28% |

---

## Our Current State (PAI v4.0.3)

| Metric | Our Value | jlacour-git's Starting Point |
|--------|-----------|------------------------------|
| SYSTEM rules | 15 | 41 (SYSTEM + USER) |
| Steering rules words | 659 | ~1,200+ (estimated) |
| CLAUDE.md words | 457 | ~730 |
| Algorithm words | 3,988 (v3.7.0) | ~2,808 (v3.5.0) |
| Total always-loaded | ~6,800 tokens est. | ~8,200 tokens |
| Performance | 5.1/10 weekly | 3-4/10 |
| Existing routing | CONTEXT_ROUTING.md | Mixed into rules |
| Existing skills | Full skill system | Full skill system |

**Key difference:** We're starting from a leaner, higher-performing baseline. The absolute gains from reform are smaller, while the risks of change remain constant.

---

## Council Debate

### Round 1: Initial Positions

**PAI Expert:** The core diagnosis (instruction fatigue at high density) is sound but targets a system we've already reformed. Cherry-pick Lateral Reclassification as an audit methodology and adopt the Priority Hierarchy as a 1-line preamble. Reject hook infrastructure and capability compression as solutions to problems we no longer have.

**Prompt Engineer:** The Scenario Test is the most important contribution — 7 of 13 compressions failed it, proving naive token reduction changes behavioral semantics. But our 659-word rule set doesn't need compression. The Algorithm's Critical Rules section (lines 357-368 of 382) sits in a low-attention zone — this is the real actionable finding. U-shaped attention claims are valid but misapplied to our structured multi-file architecture.

**Cognitive Load Designer:** Attention curve is real in principle but misapplied to our 15-rule system. Bold-keyword-first formatting already creates retrieval anchors (exactly what the research recommends). ModeClassifier hook insight about format templates as behavioral attractors is sound. Full reform would add overhead that *increases* density — the cure worse than the disease at our scale.

**Systems Architect:** Ranked proposals by architectural merit: Conditional Algorithm Read (#1) > Complexity Gate > Reclassification > LOCAL_PATCHES > ModeClassifier > ContextAssembler. ModeClassifier moves something the LLM does natively into worse code. ContextAssembler is enterprise-grade overkill for a personal system. Only Conditional Read solves a measured, real problem.

**Status Quo Defender:** Version mismatch (v3.0-3.5 → v4.0.3) is disqualifying until proven otherwise. ModeClassifier adds a new dependency. The 54% compression failure rate (7/13) is the real signal — the proposal's own data shows prose compression is unreliable. Two cautiously positive comments is not community validation. Our 5.1/10 vs their 3-4/10 means the low-hanging fruit is already picked.

### Round 2: Responses & Challenges

**Key friction points:**

1. **ModeClassifier retraction** — Cognitive Load Designer conceded after Systems Architect's argument that LLMs already do categorical routing natively. Adding a hook replaces one forward pass with three processing steps. The insight (make classification explicit) is valid; the implementation (external hook) is not.

2. **Critical Rules attention zone** — Prompt Engineer provided specific evidence: Algorithm Critical Rules sit at lines 357-368 of a 382-line file — the final 7%, a narrow recency window stacked behind 350 lines of phase instructions. Moving to lines 1-20 would exploit primacy bias. All members except Status Quo Defender agreed this is high-value, low-risk.

3. **Compression failure rate contextualized** — Cognitive Load Designer argued the 54% rate applies to aggressive compressions on structured rule sets (expected behavior), not to the lateral reclassification or testing methodologies. The failure rate defeats prose compression specifically, not the entire proposal.

4. **Status Quo Defender challenged all cherry-picks** — Called the Scenario Test "rebranded QA." Demanded failure data before any optimization. Challenged Priority Hierarchy as potentially unmeasurable.

5. **Conditional Read debate** — PAI Expert argued the real cost isn't the Read call, it's mode misclassification upstream. Fix classification accuracy first; conditional loading becomes less urgent. Systems Architect countered that the Read eliminates ~4,800 tokens of irrelevant Algorithm context on NATIVE tasks.

### Round 3: Synthesis & Votes

**Unanimous agreements (5-0):**
- REJECT ModeClassifier hook, ContextAssembler, full prose compression, capability compression

**Near-unanimous (4-1, Status Quo Defender dissenting):**
- ACCEPT Algorithm Critical Rules relocation to high-attention position
- ACCEPT Walkthrough Test as validation methodology for Algorithm changes

**Contested (no clear majority):**
- Priority Hierarchy preamble: PAI Expert yes, Prompt Engineer conditional, Cognitive Load Designer no, Systems Architect conditional, Status Quo Defender no
- Lateral Reclassification audit: PAI Expert yes, Cognitive Load Designer no, Systems Architect conditional, others no
- Conditional Algorithm Read: Systems Architect yes, Cognitive Load Designer yes, PAI Expert conditional, Prompt Engineer and Status Quo Defender no

---

## Research: Attention Curve Evidence

The council's arguments about positional attention were validated against empirical research:

**Liu et al. 2023 ("Lost in the Middle", Stanford/UC Berkeley):**
- U-shaped performance curve confirmed across Claude 1.3, GPT-3.5-turbo, MPT-30B, LLaMA-2-70B
- Mid-position accuracy drops ~20 percentage points vs beginning/end at ~5K-6K tokens
- At 8K+ tokens, mid-positioned information accuracy drops to ~56% vs ~80% at boundaries
- Mechanism: RoPE long-term decay + Softmax attention sink effect
- **Relevance to PAI:** Our Algorithm file at ~5,300 tokens is within the range where mid-document degradation is empirically measurable

**Implications for Critical Rules positioning:**
- Algorithm Critical Rules at lines 357-368 (of 382) are in a narrow recency window
- Moving them earlier would exploit primacy bias rather than relying on weak recency
- The bold-keyword-first formatting in AISTEERINGRULES.md creates local saliency peaks that partially mitigate the U-curve — this is why our 15-rule system performs reasonably despite not having a priority hierarchy

---

## Recommendations

### Tier 1: Accept (high confidence, low risk)

**1. Relocate Algorithm Critical Rules** (4-1 vote)
Move the Critical Rules section from lines 357-368 to immediately after the Algorithm's core definition (lines 1-15). This exploits primacy bias in a document where mid-document degradation is empirically expected at its token count. Zero-cost structural change.

**2. Adopt Walkthrough Test methodology** (4-1 vote)
Before any Algorithm modification, mentally execute the modified Algorithm phase-by-phase against a real task. This catches interaction effects between sections that single-rule tests miss. Especially important given Algorithm v3.7.0's length (3,988 words).

**3. Adopt Scenario Test methodology** (3-2 vote, concept not name)
For any prose compression or rule modification: "Can I construct a scenario where the original wording catches a mistake but the modified version doesn't?" The 54% failure rate in jlacour-git's own data validates this is a real risk. This is not "rebranded QA" — it's a specific test for semantic preservation in instruction compression.

### Tier 2: Investigate (contested, needs evidence)

**4. Priority Hierarchy preamble** (2Y-2C-1N)
Adding "Priority: Trust > Correctness > Quality > Efficiency" to AISTEERINGRULES.md was the original motivation for this council (prior council identified it as "~30 tokens, high value"). The debate revealed genuine disagreement: it may resolve real conflicts (PAI Expert) or it may waste the highest-attention zone on administrative scaffolding (Cognitive Load Designer). **Recommendation:** Prototype and validate with a Walkthrough Test before committing.

**5. Lateral Reclassification audit** (2Y-1C-2N)
Formally categorize each of our 15 rules as rule/convention/procedure/routing. Potentially valuable but unbounded scope. **Recommendation:** If attempted, scope to a single pass with clear completion criteria. Not urgent given our low rule count.

### Tier 3: Reject (high confidence)

**6-11. ModeClassifier hook, ContextAssembler, prose compression, capability compression, Complexity Gate, LOCAL_PATCHES** (all 4-1 or 5-0 reject)

These either solve problems we don't have (our density is below the threshold where they pay off), add complexity disproportionate to benefit (hooks as failure points), or are already handled by existing architecture (CONTEXT_ROUTING.md, BuildCLAUDE.ts, git).

---

## Dissent Record

**Status Quo Defender (dissented on all acceptances):** The burden of proof was not met for any change. No failure data demonstrates that Critical Rules positioning causes real compliance issues. Walkthrough Tests earn their keep only if actually run regularly. Every adopted methodology is a maintenance commitment. "If it becomes shelf-ware, revert."

**Cognitive Load Designer (dissented on Priority Hierarchy):** Front-loading a priority stack at the top of CLAUDE.md uses the highest-attention zone for administrative scaffolding rather than actionable context. Rules belong where they're consumed, not in a preamble.

---

## Applicability to PAI v4.0.3

| Aspect | jlacour-git's System | PAI v4.0.3 | Gap |
|--------|---------------------|------------|-----|
| Rule density | 41 rules, high fatigue | 15 rules, moderate | Already solved |
| Routing | Mixed into rules | CONTEXT_ROUTING.md exists | Already solved |
| Mode selection | Inline, format attractor | Inline, same risk | Comparable |
| Algorithm version | v3.5.0 (shorter) | v3.7.0 (3,988 words) | Different baseline |
| Capability enforcement | Proposed ~60 tokens | Already in v3.7.0 (verbose) | Already solved |
| Performance | 3-4/10 | 5.1/10 | Higher baseline |

**Bottom line:** The proposal is excellent work for the system it targets. Most of its value was in the diagnostic frameworks (lateral reclassification, scenario testing, walkthrough testing) rather than the specific implementations. For PAI v4.0.3, the frameworks transfer well; the implementations largely don't.

---

## Action Items

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | Relocate Algorithm Critical Rules to top of v3.7.0 | High | ~5 min |
| 2 | Document Walkthrough Test in Algorithm change process | Medium | ~10 min |
| 3 | Document Scenario Test for future rule modifications | Medium | ~5 min |
| 4 | Prototype Priority Hierarchy preamble + validate | Low | ~15 min |
| 5 | Consider Lateral Reclassification audit of 15 rules | Low | ~20 min |

---

*Generated by PAI Council Debate (5 agents × 3 rounds = 15 agent calls)*
*Source material: Discussion #908, 3 gists, 1 fork, 2 community comments*
*Research: Liu et al. 2023 "Lost in the Middle" empirical validation*
