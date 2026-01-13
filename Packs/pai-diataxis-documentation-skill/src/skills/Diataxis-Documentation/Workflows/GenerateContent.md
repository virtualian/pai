# Workflow: Generate Content

**Trigger:** "generate content", "fill scaffold", "write documentation content"

---

## Purpose

Fill a documentation scaffold with content:
- Extract information from sources
- Apply content type rules
- Generate documentation following Diataxis principles
- Verify quality

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

### Step 3: Generate Content

<!-- ═══════════════════════════════════════════════════════════════════════════
     TEMPLATE PLACEHOLDER - CUSTOM PROMPT
     ═══════════════════════════════════════════════════════════════════════════

     Replace this section with your custom content generation prompt.

     The prompt should receive:
     - Content type (Tutorial/How-to/Reference/Explanation)
     - Extracted source material
     - Target scaffold structure
     - Provenance annotations

     Expected output:
     - Filled documentation sections
     - Proper formatting for content type
     - Cross-references where appropriate

     ═══════════════════════════════════════════════════════════════════════════ -->

{{CONTENT_GENERATION_PROMPT}}

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

- Completed documentation file
- Content derived from sources
- Cross-references to related docs
- Follows Diataxis structure for content type

---

## Related Workflows

- `CreateScaffold.md` - Create structure first
- `PlanDocumentation.md` - Plan what docs to create
