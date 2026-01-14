# Workflow: Generate Content

**Trigger:** "generate content", "fill scaffold", "write documentation content"

---

## Purpose

Fill a documentation scaffold with content:
- Assess source quality and adapt strategy
- Gather user decisions on priorities and quality
- Generate documentation following Diataxis principles
- Verify quality

**Design Principle:** This workflow is agnostic to project type, tech stack, hosting, and content domain. It adapts to source quality—from well-documented to missing—and requires explicit user input for key decisions.

**Prerequisite:** Run `CreateScaffold.md` first to create the structure.

---

## Workflow Steps

### Step 1: Identify Scaffold and Type

Read the existing scaffold file to determine:
- Diataxis content type (Tutorial, How-to, Reference, Explanation)
- Target structure and sections
- Placeholder locations

---

### Step 2: Extract from Sources (CRITICAL)

**Documentation MUST be derived from sources. Never invent content.**

#### 2.1 Identify Relevant Sources

**Read `docs/.diataxis.md` to find configured sources.** The config specifies which sources to use (set during InitializeProject):

| Source Type | What to Look For |
|-------------|------------------|
| Existing documentation | Markdown/text files in docs directories |
| Code comments | Docstrings, inline comments, annotations |
| README files | Project and package overviews |
| API specifications | OpenAPI, GraphQL schemas, interface definitions |
| Design documents | Architecture docs, RFCs, decision records |
| Changelog/history | Version notes, release history |

**Search within configured sources only.** Use project-appropriate tools to find relevant content for the topic being documented.

#### 2.2 Extract Information by Content Type

**For Tutorial** (look for):
- Quick-start or getting-started content
- Example code or sample projects
- Test files showing usage patterns
- Comments explaining flow or sequence

**For How-to Guide** (look for):
- Code implementing the feature
- Existing task-oriented documentation
- Issue discussions showing user needs
- Test cases demonstrating expected behavior

**For Reference** (look for):
- Type definitions, interfaces, schemas
- Docstrings and API comments
- Configuration options and defaults
- Route/endpoint definitions

**For Explanation** (look for):
- Architecture decision records
- Design rationale documents
- Comments explaining "why" not "what"
- Commit messages with context
- Philosophy or principles sections

#### 2.3 Check Temporal State

For each piece of extracted information:

| Source Signal | Temporal Tag |
|---------------|--------------|
| In current code, no deprecation notice | `[CURRENT]` (default) |
| Deprecation marker in code or docs | `[DEPRECATED]` |
| Listed as removed in changelog | `[REMOVED]` - omit or note |
| In roadmap/TODO, not yet implemented | `[PLANNED]` |
| Marked "experimental" or "beta" | `[EXPERIMENTAL]` |

#### 2.4 Document Provenance

Track where each piece of information came from:

```markdown
<!-- Source: path/to/file:L45-L60 -->
[Factual claim derived from that source...]

<!-- Source: design/architecture.md -->
[Design rationale from that document...]

<!-- Source: CHANGELOG:v2.1.0 -->
> Added in v2.1.0
```

#### 2.5 Flag Gaps

When sources don't provide needed information:

```markdown
> **Documentation Gap**
> Source material does not cover:
> - Error codes and their meanings
> - Rate limiting behavior
> - Retry strategies
>
> **Action needed:** Input from engineering team
```

**NEVER fill gaps with assumptions or invented content.**

#### 2.6 Verify Source Accuracy

**Sources may be outdated or incorrect.** Before using extracted information, verify it against the actual implementation:

| Source Type | Verify Against |
|-------------|----------------|
| Architecture docs | Actual code structure, dependencies, data flow |
| API documentation | Real endpoints, parameters, responses |
| Configuration docs | Actual config files, defaults, valid options |
| Design decisions | Whether implementation matches stated design |
| Examples/snippets | Whether code actually runs and produces stated output |

**Verification process:**

1. **Identify verifiable claims** - Facts that can be checked (not opinions or rationale)
2. **Cross-reference with implementation** - Check if code matches documentation
3. **Flag discrepancies** - Mark inaccurate content for correction

**Inaccuracy markers:**

```markdown
[INACCURATE: docs claim X but code shows Y]
[STALE: documented feature no longer exists]
[INCOMPLETE: docs describe 3 options but code has 5]
[MISMATCH: API signature differs from documentation]
```

**Report inaccuracies to user:**

```markdown
## Source Accuracy Report

| Source | Claim | Reality | Status |
|--------|-------|---------|--------|
| design/auth.md | "Uses session tokens" | Code uses JWT | INACCURATE |
| api/users.md | "Returns 5 fields" | Returns 7 fields | INCOMPLETE |
| config.md | "Default timeout: 30s" | Default is 60s | STALE |
```

**When sources conflict with implementation:**
- Trust implementation over documentation (unless user chose otherwise in Step 4)
- Flag the discrepancy so docs can be corrected
- Use verified facts in generated content

---

### Step 3: Assess Source Quality

Before generating, classify the source material:

| Quality Level | Indicators | Strategy |
|---------------|------------|----------|
| **Well-documented** | Existing docs, rich comments, examples | Extract and reorganize for Diataxis type |
| **Sparse** | Code exists but minimal docs/comments | Generate from code/specs, flag assumptions |
| **Poor quality** | Outdated, contradictory, or unclear | Identify salvageable parts, mark rest for rewrite |
| **Missing** | No sources for required content | Leave explicit `[GAP: ...]` markers |

---

### Step 4: Gather User Decisions

**Ask before generating:**

```json
{
  "header": "Sources",
  "question": "When sources conflict, which should take priority?",
  "multiSelect": false,
  "options": [
    {"label": "Code", "description": "Trust implementation over documentation"},
    {"label": "Docs", "description": "Trust existing docs over current code"},
    {"label": "Ask each time", "description": "Flag conflicts for manual resolution"}
  ]
}
```

```json
{
  "header": "Quality",
  "question": "What quality level for this content?",
  "multiSelect": false,
  "options": [
    {"label": "Draft", "description": "Good enough to review, may have rough edges"},
    {"label": "Polished", "description": "Ready for publication, fully refined"}
  ]
}
```

```json
{
  "header": "Gaps",
  "question": "How should content gaps be handled?",
  "multiSelect": false,
  "options": [
    {"label": "Explicit gaps", "description": "Leave [GAP: ...] markers for missing info"},
    {"label": "Placeholder text", "description": "Generate reasonable placeholders marked [PLACEHOLDER]"}
  ]
}
```

---

### Step 5: Generate Content

Using the extracted source material and user decisions:

#### Input Context
- **Content Type:** Tutorial | How-to | Reference | Explanation
- **Scaffold File:** Path with `[TODO: ...]` markers
- **Source Quality:** Well-documented | Sparse | Poor | Missing
- **User Decisions:** Priority, quality level, gap handling

#### Generation Rules

1. **Replace each `[TODO: ...]`** with content derived from sources
2. **Maintain provenance** - `<!-- Source: path:lines -->` for key claims
3. **Follow content type rules** (Step 6)
4. **Mark uncertainty and issues:**
   - `[GAP: description]` - sources don't cover this
   - `[PLACEHOLDER: description]` - generated without source (if user chose this)
   - `[CONFLICT: source1 vs source2]` - sources disagree (if user chose "ask each time")
   - `[INACCURATE: docs say X but code shows Y]` - source doesn't match implementation

#### By Source Quality

**Well-documented sources:**
- Extract directly, reorganize for Diataxis type
- Preserve technical accuracy
- Update examples if outdated

**Sparse sources:**
- Generate from code structure and signatures
- Flag inferred behavior: `<!-- Inferred from: path -->`
- Be conservative - don't guess intent

**Poor quality sources:**
- Extract only verifiable facts
- Mark questionable content: `[VERIFY: claim from outdated-doc.md]`
- Note what needs rewriting

**Missing sources:**
- Use `[GAP: ...]` or `[PLACEHOLDER: ...]` per user choice
- Don't invent technical details
- Scaffold structure is still valuable

#### Content Type Guidance

**Tutorial:** Second person, explicit steps, show expected output, no theory
**How-to:** Assume basics known, numbered steps, include verification
**Reference:** Factual only, exhaustive, consistent structure, types/defaults/examples
**Explanation:** Context first, "why" not "what", trade-offs, connections

---

### Step 6: Apply Content Type Rules

#### Tutorial Rules
- Use "you" (second person)
- Make every step explicit
- Show expected output after commands
- Don't explain theory (link to explanation)
- Don't offer choices (decide for the learner)
- End with celebration and next steps

#### How-to Rules
- Start with clear goal statement
- Use numbered steps
- Assume user knows basics
- Be specific about what to do
- Include verification
- Cover common problems

#### Reference Rules
- Be factual, no opinions
- Be exhaustive
- Use consistent structure
- Include types and defaults
- Provide examples
- Don't explain why (link to explanation)

#### Explanation Rules
- Provide context first
- Explain "why" not just "what"
- Discuss alternatives
- Mention trade-offs
- Connect to other concepts
- Don't give step-by-step instructions

---

### Step 7: Check Against Anti-Patterns

Before finalizing, verify:

| If Writing | Should NOT Include |
|------------|--------------------|
| Tutorial | Long explanations, choices, edge cases |
| How-to | Teaching concepts, theory |
| Reference | Advice, opinions, tutorials |
| Explanation | Step-by-step instructions |

---

### Step 8: Add Cross-References

Link to related documentation:
- Tutorial → Explanation (for theory), How-to (for next steps)
- How-to → Reference (for details), Explanation (for context)
- Reference → How-to (for usage examples)
- Explanation → Tutorial (for hands-on), Reference (for specifics)

---

### Step 9: Write Content to Scaffold

Use the Edit tool to replace placeholder sections with generated content.

---

### Step 10: Verify Quality

Run through quality checklist from `Standard.md`:

**All docs:**
- [ ] Clear title stating what it is
- [ ] Appropriate content type (not mixed)
- [ ] Links to related docs
- [ ] Consistent with existing docs

**Type-specific:**
- [ ] Tutorials: Meaningful result, explicit steps
- [ ] How-to: Clear goal, verification section
- [ ] Reference: Complete, consistent structure
- [ ] Explanation: Context, "why" focus

---

## Output

- Documentation file with `[TODO: ...]` markers replaced
- Content derived from sources with provenance comments
- Explicit markers: `[GAP: ...]`, `[PLACEHOLDER: ...]`, `[CONFLICT: ...]`, `[INACCURATE: ...]`
- Cross-references to related docs (only to existing targets)
- Follows Diataxis structure for content type

---

## Related Workflows

- `CreateScaffold.md` - Create structure first
- `PlanDocumentation.md` - Plan what docs to create
