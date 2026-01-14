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

Based on Config.md source priorities, identify files to extract from:

```bash
# Find source files for the topic
grep -r "topic_keyword" --include="*.ts" --include="*.md" --include="*.json" .

# Check code comments
grep -r "TODO\|NOTE\|@param\|@returns" src/

# Check existing documentation
find docs/ -name "*.md" -exec grep -l "topic" {} \;

# Check changelog for temporal context
grep -i "topic" CHANGELOG.md
```

#### 2.2 Extract Information by Content Type

**For Tutorial** (extract from):
- README quick-start sections
- Existing example code in `examples/`
- Test files showing usage patterns
- Code comments explaining flow

**For How-to Guide** (extract from):
- Code that implements the feature
- Existing docs mentioning the task
- Stack Overflow/issues showing user needs
- Test cases demonstrating expected behavior

**For Reference** (extract from):
- Type definitions and interfaces
- JSDoc/docstring comments
- Configuration schemas
- API route definitions
- Default values in code

**For Explanation** (extract from):
- Architecture decision records (ADRs)
- Design documents
- Code comments explaining "why"
- Git commit messages for context
- README philosophy sections

#### 2.3 Check Temporal State

For each piece of extracted information:

| Source Signal | Temporal Tag |
|---------------|--------------|
| In current code, no deprecation notice | `[CURRENT]` (default) |
| `@deprecated` JSDoc tag | `[DEPRECATED]` |
| In CHANGELOG under "Removed" | `[REMOVED]` - omit or note |
| In roadmap/TODO, not in code | `[PLANNED]` |
| Marked "experimental" or "beta" | `[EXPERIMENTAL]` |

#### 2.4 Document Provenance

Track where each piece of information came from:

```markdown
<!-- Source: src/api/auth.ts:L45-L60 -->
Authentication uses JWT tokens with a 24-hour expiry...

<!-- Source: docs/design/auth-flow.md -->
The authentication flow was designed to minimize round-trips...

<!-- Source: CHANGELOG.md:v2.1.0 -->
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

### Step 3.1: Gather User Decisions

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

### Step 3.2: Generate Content

Using the extracted source material and user decisions:

#### Input Context
- **Content Type:** Tutorial | How-to | Reference | Explanation
- **Scaffold File:** Path with `[TODO: ...]` markers
- **Source Quality:** Well-documented | Sparse | Poor | Missing
- **User Decisions:** Priority, quality level, gap handling

#### Generation Rules

1. **Replace each `[TODO: ...]`** with content derived from sources
2. **Maintain provenance** - `<!-- Source: path:lines -->` for key claims
3. **Follow content type rules** (Step 4)
4. **Mark uncertainty:**
   - `[GAP: description]` - sources don't cover this
   - `[PLACEHOLDER: description]` - generated without source (if user chose this)
   - `[CONFLICT: source1 vs source2]` - sources disagree (if user chose "ask each time")

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

### Step 4: Apply Content Type Rules

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

### Step 5: Check Against Anti-Patterns

Before finalizing, verify:

| If Writing | Should NOT Include |
|------------|--------------------|
| Tutorial | Long explanations, choices, edge cases |
| How-to | Teaching concepts, theory |
| Reference | Advice, opinions, tutorials |
| Explanation | Step-by-step instructions |

---

### Step 6: Add Cross-References

Link to related documentation:
- Tutorial → Explanation (for theory), How-to (for next steps)
- How-to → Reference (for details), Explanation (for context)
- Reference → How-to (for usage examples)
- Explanation → Tutorial (for hands-on), Reference (for specifics)

---

### Step 7: Write Content to Scaffold

Use the Edit tool to replace placeholder sections with generated content.

---

### Step 8: Verify Quality

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
- Explicit markers for gaps: `[GAP: ...]`, `[PLACEHOLDER: ...]`, `[CONFLICT: ...]`
- Cross-references to related docs (only to existing targets)
- Follows Diataxis structure for content type

---

## Related Workflows

- `CreateScaffold.md` - Create structure first
- `PlanDocumentation.md` - Plan what docs to create
