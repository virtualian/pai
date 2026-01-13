# Diataxis Documentation Standard

This document defines the Diataxis framework as applied to PAI documentation.

---

## The Diataxis Framework

Diataxis is a systematic approach to documentation based on the insight that documentation serves four distinct user needs, requiring four distinct content types.

### The Four Quadrants

```
                    PRACTICAL                    THEORETICAL
                 (doing/action)               (understanding)
              ┌─────────────────────┬─────────────────────┐
   LEARNING   │     TUTORIALS       │    EXPLANATION      │
   (acquiring)│  learning-oriented  │ understanding-orien │
              │                     │                     │
              │  "Follow along to   │  "This is how X     │
              │   learn how..."     │   works because..." │
              ├─────────────────────┼─────────────────────┤
   WORKING    │    HOW-TO GUIDES    │    REFERENCE        │
   (applying) │   task-oriented     │ information-orient  │
              │                     │                     │
              │  "Do this to        │  "X takes these     │
              │   achieve Y..."     │   parameters..."    │
              └─────────────────────┴─────────────────────┘
```

### Key Insight

Each quadrant serves a different user in a different mode:

| User Mode | Practical Need | Theoretical Need |
|-----------|---------------|------------------|
| **Learning** (acquiring knowledge) | Tutorial | Explanation |
| **Working** (applying knowledge) | How-to Guide | Reference |

---

## 1. Tutorials (Learning-Oriented)

### Purpose
Teach a newcomer by guiding them through a series of steps to complete a meaningful project.

### Characteristics
- **Learning by doing** - User follows along, executing each step
- **Instructor-led** - You decide what to teach and in what order
- **Meaningful outcome** - Ends with something that works
- **Safe environment** - Mistakes are expected and recoverable

### Structure
```markdown
# Tutorial: [Meaningful Project Name]

## What You'll Build
[Brief description of the end result]

## Prerequisites
- [Tool/knowledge required]

## Steps

### Step 1: [Action Verb] [Object]
[Explanation of what we're doing]

```code
[Command or code to execute]
```

[Expected result]

### Step 2: [Action Verb] [Object]
...

## What You've Learned
[Summary of concepts covered]

## Next Steps
[Links to related tutorials or how-to guides]
```

### Do's
- Start with a working result, not theory
- Use second person ("you")
- Give explicit, complete steps
- Explain what will happen before each step
- Celebrate progress

### Don'ts
- Don't explain how things work (link to Explanation)
- Don't offer choices (make decisions for the learner)
- Don't cover edge cases
- Don't assume prior knowledge

### Example Titles
- "Tutorial: Build Your First API"
- "Tutorial: Deploy to Production in 15 Minutes"
- "Getting Started with Authentication"

---

## 2. How-To Guides (Task-Oriented)

### Purpose
Help an experienced user accomplish a specific task.

### Characteristics
- **Goal-oriented** - User has a specific outcome in mind
- **Assumes competence** - User knows the basics
- **Practical** - Steps to achieve a result
- **Focused** - Does one thing well

### Structure
```markdown
# How to [Accomplish Specific Goal]

## Overview
[One sentence describing what this guide helps you do]

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

### Do's
- Start with a clear goal statement
- Use numbered steps
- Be specific about what to do
- Include verification steps
- Cover common problems

### Don'ts
- Don't teach concepts (link to Tutorial or Explanation)
- Don't explain why (link to Explanation)
- Don't cover every edge case
- Don't assume unfamiliarity

### Example Titles
- "How to Configure SSO"
- "How to Migrate from v1 to v2"
- "How to Debug Memory Leaks"

---

## 3. Reference (Information-Oriented)

### Purpose
Provide accurate, complete technical description.

### Characteristics
- **Factual** - Describes what is, not what to do
- **Complete** - Covers everything
- **Consistent** - Same structure throughout
- **Austere** - No opinions, no guidance

### Structure
```markdown
# [Component/API/Module Name] Reference

## Overview
[One sentence description]

## [Section Name]

### [Item Name]
**Type:** [type]
**Default:** [default value]
**Required:** [yes/no]

[Description of what this is]

**Example:**
```code
[Usage example]
```

### [Next Item]
...

## See Also
- [Related reference]
- [How-to guide using this]
```

### Do's
- Use consistent formatting
- Be exhaustive
- Include types, defaults, constraints
- Provide examples
- Keep descriptions factual

### Don'ts
- Don't explain why things work this way
- Don't give advice
- Don't include tutorials
- Don't vary the structure

### Example Titles
- "Configuration Reference"
- "API Reference: /users endpoint"
- "CLI Commands Reference"

---

## 4. Explanation (Understanding-Oriented)

### Purpose
Help the user understand concepts, design decisions, and how things work.

### Characteristics
- **Theoretical** - About understanding, not doing
- **Discursive** - Can explore topics
- **Contextual** - Places things in perspective
- **Illuminating** - Provides insight

### Structure
```markdown
# [Topic]: [Aspect Being Explained]

## Overview
[What this explanation covers]

## Background
[Context needed to understand]

## [Main Concept]
[Explanation of the concept]

### [Sub-topic]
[Deeper exploration]

## Design Decisions
[Why things are the way they are]

## Trade-offs
[What was gained and lost]

## Related Concepts
- [Link to related explanation]
- [Link to tutorial that uses this concept]
```

### Do's
- Provide context and background
- Explain "why" not just "what"
- Connect concepts to each other
- Discuss alternatives and trade-offs
- Use analogies when helpful

### Don'ts
- Don't give step-by-step instructions
- Don't be exhaustive (that's Reference)
- Don't assume practical context
- Don't focus on specific tasks

### Example Titles
- "Understanding the Event Loop"
- "Why We Chose PostgreSQL"
- "Architecture: How Caching Works"

---

## PAI Adaptations

### File Naming

| Convention | Example |
|------------|---------|
| TitleCase for docs | `GettingStarted.md` |
| Descriptive names | `HowToDeployToAWS.md` |
| Type prefix (optional) | `Tutorial-FirstAPI.md` |

### Docusaurus Integration

When using Docusaurus (`website/` structure):

```
website/docs/
├── tutorials/           # Learning-oriented
│   ├── getting-started.md
│   └── first-project.md
├── how-to/              # Task-oriented
│   ├── deploy.md
│   └── configure-auth.md
├── reference/           # Information-oriented
│   ├── api.md
│   └── configuration.md
└── concepts/            # Understanding-oriented (explanation)
    ├── architecture.md
    └── design-decisions.md
```

### Skill Documentation

PAI skill files (`SKILL.md`) are NOT Diataxis. They follow skill conventions:
- YAML frontmatter with `name:` and `description:`
- Workflow routing table
- Examples section
- Quick reference

### Scope Exclusions

These repo files are NOT Diataxis content:
- `README.md` - Project overview (hybrid: part explanation, part quick-start)
- `CONTRIBUTING.md` - Contribution process
- `CHANGELOG.md` - Version history
- `LICENSE` - Legal
- `CODE_OF_CONDUCT.md` - Community standards
- `.github/*.md` - GitHub templates

---

## Anti-Patterns

### Mixed Content

| Problem | What's Wrong | Solution |
|---------|--------------|----------|
| Tutorial with long explanations | Breaks flow, overwhelms learner | Move to Explanation, link |
| How-to that teaches basics | User already knows, wastes time | Link to Tutorial |
| Reference with advice | Opinions don't belong | Move to How-to |
| Explanation with steps | Confuses doing with understanding | Split into Explanation + How-to |

### Wrong Content Type

| If You're Writing... | But Include... | It's Actually... |
|---------------------|----------------|-----------------|
| "Tutorial" | No hands-on steps | Explanation |
| "Guide" | Exhaustive options list | Reference |
| "Reference" | Opinions on usage | How-to |
| "Overview" | Step-by-step instructions | Tutorial or How-to |

### Signals You're in Wrong Quadrant

- Tutorial: "You might want to..." (offering choices = How-to)
- How-to: "Let's learn about..." (teaching = Tutorial)
- Reference: "The best way is..." (advice = How-to)
- Explanation: "First, do this..." (steps = Tutorial/How-to)

---

## Source Fidelity

**Documentation MUST be derived from authoritative sources, never invented.**

### The No-Hallucination Rule

| Do | Don't |
|----|-------|
| Extract information from source code, comments, specs | Invent features or behaviors |
| Transform existing content into Diataxis structure | Add information not in sources |
| Flag gaps for subject matter experts | Fill gaps with assumptions |
| Cross-reference multiple sources | Trust a single outdated source |

### Provenance Tracking

Every piece of documentation should be traceable:

```markdown
<!-- Source: src/api/endpoints.ts:L45-L80 -->
## User Endpoints

The `/users` endpoint supports the following operations...

<!-- Source: docs/specs/auth-flow.md -->
### Authentication Flow

Users authenticate using OAuth 2.0...

<!-- Source: CHANGELOG.md:v2.0.0 -->
> **Note:** This endpoint was added in v2.0.0.
```

### Source Priority

When sources conflict, follow Config.md priority order:
1. Higher-priority sources override lower
2. More recent sources override older (check dates)
3. Code is ground truth for behavior (not aspirational docs)

### Gap Handling

When sources don't cover a topic:

```markdown
## Feature X

> **Documentation Gap**
> This section requires input from the engineering team.
> Source material does not cover:
> - Configuration options for Feature X
> - Error handling behavior
> - Performance characteristics

[Basic information extracted from code comments...]
```

**Never fill gaps with invented content.** Flag and move on.

---

## Temporal Awareness

Documentation must clearly indicate whether content describes past, present, or future capabilities.

### Temporal Tags

| Tag | Meaning | When Source Says |
|-----|---------|-----------------|
| `[CURRENT]` | Available now, recommended | (default - no special signal) |
| `[DEPRECATED]` | Works but being phased out | "deprecated", "legacy", "obsolete", "avoid" |
| `[REMOVED]` | No longer available | "removed", "deleted", "no longer", "was" |
| `[PLANNED]` | On roadmap, not shipped | "will", "planned", "coming", "future", "roadmap" |
| `[EXPERIMENTAL]` | Available but unstable | "experimental", "beta", "alpha", "unstable" |

### Visual Indicators by Technology

**Docusaurus:**
```jsx
import {Deprecated, Experimental} from '@site/src/components/Badges';

<Deprecated version="2.0" alternative="/docs/new-feature">
This feature is deprecated.
</Deprecated>
```

**MkDocs Material:**
```markdown
!!! warning "Deprecated"
    This feature is deprecated. Use [New Feature](new-feature.md) instead.

!!! info "Coming Soon"
    This feature is planned for Q2 2026.
```

**Plain Markdown:**
```markdown
> ⚠️ **Deprecated:** This feature will be removed in v3.0.

> 🔮 **Planned:** This feature is on the roadmap for Q2 2026.

> 🧪 **Experimental:** This feature is unstable and may change.
```

### Source Date Awareness

When extracting from sources, check temporal validity:

| Source Signal | Action |
|---------------|--------|
| Source dated before current version | Verify content still accurate |
| Source mentions future dates in past | Check if shipped → mark `[CURRENT]` |
| Source mentions future dates ahead | Keep as `[PLANNED]` |
| No date on source | Cross-reference with code/changelog |

### Changelog Integration

Use CHANGELOG.md to determine temporal state:
- Feature in changelog as "Added" → `[CURRENT]`
- Feature in changelog as "Deprecated" → `[DEPRECATED]`
- Feature in changelog as "Removed" → `[REMOVED]` or omit
- Feature not in any changelog → verify in code

---

## Quality Checklist

### All Documentation
- [ ] Clear title stating what it is
- [ ] Appropriate content type (not mixed)
- [ ] Links to related docs in other quadrants
- [ ] Consistent with project's documentation standards
- [ ] **Source citations for all factual claims**
- [ ] **Temporal tags where applicable**
- [ ] **No invented/hallucinated content**

### Tutorials
- [ ] Has meaningful end result
- [ ] Every step is explicit
- [ ] No unexplained choices
- [ ] Celebratory conclusion

### How-to Guides
- [ ] Clear goal statement
- [ ] Numbered steps
- [ ] Verification section
- [ ] Troubleshooting for common issues

### Reference
- [ ] Consistent structure throughout
- [ ] Complete coverage
- [ ] Factual, no opinions
- [ ] Examples for each item

### Explanation
- [ ] Provides context/background
- [ ] Explains "why"
- [ ] Discusses trade-offs
- [ ] Links to practical guides

---

## References

- [Diataxis.fr](https://diataxis.fr/) - Official Diataxis documentation
- [The Documentation System](https://documentation.divio.com/) - Divio's implementation
- [What nobody tells you about documentation](https://www.youtube.com/watch?v=t4vKPhjcMZg) - Daniele Procida's talk
