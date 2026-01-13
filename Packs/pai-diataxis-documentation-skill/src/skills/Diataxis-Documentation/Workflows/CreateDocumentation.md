# Workflow: Create Documentation

**Trigger:** "create tutorial", "write how-to", "create reference", "write explanation", "new documentation", "document X"

---

## Purpose

Create new documentation following Diataxis principles:
- Determine correct content type
- Apply appropriate structure
- Follow role priorities from Config.md
- Maintain consistency with existing docs

---

## Workflow Steps

### Step 1: Read Configuration

**Read `Config.md` first.** Extract:
- Target roles and their priorities
- Content type priorities per role
- Documentation location
- Any relevant notes

```bash
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
cat "$PAI_DIR/skills/Diataxis-Documentation/Config.md"
```

---

### Step 2: Determine Content Type

If not specified by user, determine the appropriate Diataxis type:

```markdown
## Content Type Decision Tree

Is the user trying to LEARN something new?
├─ YES → Is it practical (hands-on)?
│        ├─ YES → **TUTORIAL**
│        └─ NO  → **EXPLANATION**
└─ NO  → Does the user have a specific GOAL?
         ├─ YES → **HOW-TO GUIDE**
         └─ NO  → **REFERENCE**
```

**Ask if unclear:**

```json
{
  "header": "Doc Type",
  "question": "What kind of documentation are you creating?",
  "multiSelect": false,
  "options": [
    {"label": "Tutorial", "description": "Learning-oriented, hands-on guide for newcomers"},
    {"label": "How-to Guide", "description": "Task-oriented steps to accomplish a specific goal"},
    {"label": "Reference", "description": "Factual, complete technical specification"},
    {"label": "Explanation", "description": "Conceptual content explaining why things work"}
  ]
}
```

---

### Step 3: Extract from Sources (CRITICAL)

**Documentation MUST be derived from sources. Never invent content.**

#### 3.1 Identify Relevant Sources

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

#### 3.2 Extract Information by Content Type

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

#### 3.3 Check Temporal State

For each piece of extracted information:

| Source Signal | Temporal Tag |
|---------------|--------------|
| In current code, no deprecation notice | `[CURRENT]` (default) |
| `@deprecated` JSDoc tag | `[DEPRECATED]` |
| In CHANGELOG under "Removed" | `[REMOVED]` - omit or note |
| In roadmap/TODO, not in code | `[PLANNED]` |
| Marked "experimental" or "beta" | `[EXPERIMENTAL]` |

#### 3.4 Document Provenance

Track where each piece of information came from:

```markdown
<!-- Source: src/api/auth.ts:L45-L60 -->
Authentication uses JWT tokens with a 24-hour expiry...

<!-- Source: docs/design/auth-flow.md -->
The authentication flow was designed to minimize round-trips...

<!-- Source: CHANGELOG.md:v2.1.0 -->
> Added in v2.1.0
```

#### 3.5 Flag Gaps

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

### Step 4: Apply Structure Template

Use the appropriate structure from `Standard.md`:

#### Tutorial Structure
```markdown
# Tutorial: [Meaningful Project Name]

## What You'll Build
[Brief description of the end result - make it compelling]

## Prerequisites
- [Tool/knowledge required]

## Steps

### Step 1: [Action Verb] [Object]
[Explanation of what we're doing and why]

```code
[Command or code to execute]
```

You should see:
```
[Expected output]
```

### Step 2: [Action Verb] [Object]
...

## What You've Learned
- [Concept 1]
- [Concept 2]

## Next Steps
- [Link to related tutorial]
- [Link to how-to for advanced usage]
```

#### How-to Guide Structure
```markdown
# How to [Accomplish Specific Goal]

## Overview
[One sentence: what this guide helps you accomplish]

## Prerequisites
- [Required tool/access/knowledge]

## Steps

### 1. [Action verb] [object]
[Step instruction]

```code
[Command or code]
```

### 2. [Action verb] [object]
...

## Verification
[How to confirm success]

## Troubleshooting

### [Common problem]
[Solution]

## Related
- [Link to related how-to]
- [Link to reference]
```

#### Reference Structure
```markdown
# [Component/API/Module Name] Reference

## Overview
[One sentence description]

## [Section Name]

### [Item Name]

| Property | Value |
|----------|-------|
| Type | [type] |
| Default | [default] |
| Required | [yes/no] |

[Description]

**Example:**
```code
[Usage example]
```

## See Also
- [Related reference]
- [How-to using this]
```

#### Explanation Structure
```markdown
# [Topic]: [Aspect Being Explained]

## Overview
[What this explanation covers and why it matters]

## Background
[Context needed to understand]

## [Main Concept]
[Explanation of the concept]

### [Sub-topic]
[Deeper exploration]

## Design Decisions
[Why things are the way they are]

## Trade-offs
[What was gained and lost in this design]

## Related Concepts
- [Link to related explanation]
- [Link to tutorial using this concept]
```

---

### Step 5: Write Content

Follow content type rules:

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

### Step 6: Check Against Anti-Patterns

Before finalizing, verify:

| If Writing | Should NOT Include |
|------------|--------------------|
| Tutorial | Long explanations, choices, edge cases |
| How-to | Teaching concepts, theory |
| Reference | Advice, opinions, tutorials |
| Explanation | Step-by-step instructions |

---

### Step 7: Determine File Location

Based on Diataxis type and Config.md:

```markdown
## File Placement

| Type | Location |
|------|----------|
| Tutorial | `docs/tutorials/[name].md` |
| How-to | `docs/how-to/[name].md` |
| Reference | `docs/reference/[name].md` |
| Explanation | `docs/concepts/[name].md` |
```

**File naming:**
- Use TitleCase: `GettingStarted.md`
- Or kebab-case: `getting-started.md` (for Docusaurus)
- Be descriptive: `DeployToAWS.md` not `deploy.md`

---

### Step 8: Add Cross-References

Link to related documentation:
- Tutorial → Explanation (for theory), How-to (for next steps)
- How-to → Reference (for details), Explanation (for context)
- Reference → How-to (for usage examples)
- Explanation → Tutorial (for hands-on), Reference (for specifics)

---

### Step 9: Write the Document

Use the Write tool to create the file:

```bash
# Create file
$PAI_DIR/docs/tutorials/getting-started.md
```

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

- New documentation file in correct location
- Cross-references to related docs
- Follows Diataxis structure for content type

---

## Related Workflows

- `PlanDocumentation.md` - Plan what docs to create
- `OrganizeDocumentation.md` - Reorganize existing docs
