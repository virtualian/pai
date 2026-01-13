# InitializeProject Workflow

**Trigger:** First use of Diataxis-Documentation skill in a project, OR explicit "set up docs", "initialize documentation", "create docs site".

**Purpose:** Configure and scaffold a documentation site for this specific project.

---

## Detection

**Check for existing project configuration:**

```bash
# Check for docs config file
if [ -f "./docs/.diataxis.md" ]; then
  echo "✓ Project already configured"
  cat ./docs/.diataxis.md
else
  echo "⚠️  No docs configuration - run InitializeProject"
fi

# Check for existing docs/ directory
if [ -d "./docs" ]; then
  DOC_COUNT=$(find ./docs -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "Existing docs/: $DOC_COUNT markdown files"
else
  echo "No docs/ directory"
fi
```

**If `./docs/.diataxis.md` exists:** Skip to other workflows (PlanDocumentation, CreateDocumentation, etc.)

**If not:** Run this initialization workflow.

---

## Phase 1: Project Analysis

Before asking questions, analyze the project:

```bash
# Detect project type
if [ -f "package.json" ]; then
  echo "Node.js project detected"
  cat package.json | head -20
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
  echo "Python project detected"
elif [ -f "go.mod" ]; then
  echo "Go project detected"
elif [ -f "Cargo.toml" ]; then
  echo "Rust project detected"
fi

# Check for existing README
[ -f "README.md" ] && echo "README.md exists" && head -50 README.md
```

---

## Phase 2: User Questions

### Question 1: Documentation Site Purpose

```json
{
  "header": "Purpose",
  "question": "What is the primary purpose of your documentation site?",
  "multiSelect": false,
  "options": [
    {"label": "Developer Portal (Recommended)", "description": "API docs, SDK guides, integration tutorials for developers"},
    {"label": "Product Documentation", "description": "User guides, feature docs, help center for end users"},
    {"label": "Internal/Team Docs", "description": "Engineering docs, runbooks, architecture decisions"},
    {"label": "Open Source Project", "description": "README-driven, contributor guides, community docs"}
  ]
}
```

### Question 2: Documentation Hosting

```json
{
  "header": "Hosting",
  "question": "Where will your documentation be hosted?",
  "multiSelect": false,
  "options": [
    {"label": "GitHub Pages (Recommended)", "description": "Free, git-integrated, works with most static site generators"},
    {"label": "Vercel/Netlify", "description": "Modern JAMstack hosting with preview deployments"},
    {"label": "Self-hosted", "description": "Your own infrastructure (nginx, S3, etc.)"},
    {"label": "Docs platform", "description": "ReadMe, GitBook, Notion, or similar managed platform"}
  ]
}
```

### Question 3: Documentation Technology

**Recommend based on Purpose + Hosting answers:**

```json
{
  "header": "Technology",
  "question": "Which documentation technology should we use?",
  "multiSelect": false,
  "options": [
    {"label": "Docusaurus (Recommended)", "description": "React-based, versioning, search, MDX support - great for developer portals"},
    {"label": "MkDocs + Material", "description": "Python-based, clean design, simpler setup - great for technical docs"},
    {"label": "Astro Starlight", "description": "Fast, modern, component islands - great for performance"},
    {"label": "Plain Markdown", "description": "No build step, GitHub renders directly - great for simple projects"}
  ]
}
```

**Technology recommendation logic:**

| Purpose | Hosting | Recommended Technology |
|---------|---------|----------------------|
| Developer Portal | Any | Docusaurus (versioning, API docs integration) |
| Product Docs | Docs platform | Platform's native format |
| Product Docs | Other | MkDocs Material (clean, searchable) |
| Internal/Team | GitHub Pages | Plain Markdown or MkDocs |
| Open Source | GitHub Pages | Docusaurus or Plain Markdown |

### Question 4: Documentation Roles

```json
{
  "header": "Roles",
  "question": "What roles/audiences does your documentation serve?",
  "multiSelect": true,
  "options": [
    {"label": "Developers (Recommended)", "description": "People writing code against your project"},
    {"label": "Users", "description": "End users of your application or library"},
    {"label": "Operators", "description": "DevOps, SRE, people deploying and running your system"},
    {"label": "Contributors", "description": "Open source contributors to your project"}
  ]
}
```

### Question 5: Priority Diataxis Elements

**Ask for EACH role selected:**

```json
{
  "header": "[Role] Docs",
  "question": "For [ROLE], which Diataxis content types are most important?",
  "multiSelect": true,
  "options": [
    {"label": "How-to Guides (Recommended)", "description": "Task-oriented guides for accomplishing specific goals"},
    {"label": "Reference", "description": "Technical specifications, API docs, configuration options"},
    {"label": "Tutorials", "description": "Learning-oriented content for newcomers"},
    {"label": "Explanation", "description": "Conceptual content explaining why things work"}
  ]
}
```

### Question 6: Documentation Sources

```json
{
  "header": "Sources",
  "question": "What sources should inform your documentation?",
  "multiSelect": true,
  "options": [
    {"label": "Existing docs/", "description": "Current documentation directory"},
    {"label": "Code comments", "description": "JSDoc, docstrings, inline comments"},
    {"label": "README files", "description": "README.md and package READMEs"},
    {"label": "External specs", "description": "API specs, design docs, RFCs"}
  ]
}
```

---

## Phase 3: Scaffold Documentation Site

Based on technology choice, scaffold the docs site:

### Docusaurus

```bash
# Create Docusaurus site in website/ or docs-site/
npx create-docusaurus@latest website classic --typescript

# Or if docs/ should be the content directory with site in website/
mkdir -p docs
```

**Docusaurus structure:**
```
website/
├── docs/           # Documentation content (Diataxis-organized)
├── src/            # Custom pages, components
├── static/         # Static assets
├── docusaurus.config.js
└── sidebars.js
```

### MkDocs + Material

```bash
# Create MkDocs structure
mkdir -p docs
pip install mkdocs-material  # or add to requirements.txt

# Create mkdocs.yml
```

**MkDocs structure:**
```
docs/
├── index.md
├── tutorials/
├── how-to/
├── reference/
└── explanation/
mkdocs.yml
```

### Plain Markdown

```bash
mkdir -p docs/{tutorials,how-to,reference,explanation}
```

**Plain structure:**
```
docs/
├── README.md       # Index
├── tutorials/
├── how-to/
├── reference/
└── explanation/
```

---

## Phase 4: Create Project Configuration

**Create `docs/.diataxis.md` with user's choices:**

```markdown
# Diataxis Documentation Configuration

> Auto-generated by Diataxis-Documentation skill on [DATE]

## Site Configuration

- **Purpose:** [Developer Portal | Product Docs | Internal | Open Source]
- **Hosting:** [GitHub Pages | Vercel/Netlify | Self-hosted | Docs platform]
- **Technology:** [Docusaurus | MkDocs | Astro Starlight | Plain Markdown]

## Roles & Audiences

| Role | Priority |
|------|----------|
| developers | primary |
| users | secondary |

## Diataxis Elements by Role

| Role | Tutorials | How-to | Reference | Explanation |
|------|-----------|--------|-----------|-------------|
| developers | - | ✓ | ✓ | ✓ |
| users | ✓ | ✓ | - | - |

## Documentation Sources

1. existing docs/ directory
2. code comments and docstrings

## Scope Exclusions

Standard repo files (outside Diataxis scope):
- README.md, LICENSE, CONTRIBUTING.md, CHANGELOG.md
- CODE_OF_CONDUCT.md, SECURITY.md, .github/*.md
- SKILL.md files (PAI skills)

Custom exclusions:
- (none configured)
```

---

## Phase 5: Create Initial Structure

Based on role priorities, create starter files:

```bash
# Example for Docusaurus with developers as primary role
mkdir -p website/docs/{how-to,reference,explanation}

# Create index
cat > website/docs/intro.md << 'EOF'
---
sidebar_position: 1
---

# Introduction

Welcome to the documentation.

<!-- TODO: Add project overview -->
EOF

# Create placeholder for each priority type
cat > website/docs/how-to/index.md << 'EOF'
# How-to Guides

Task-oriented guides for accomplishing specific goals.

<!-- TODO: Add how-to guides -->
EOF
```

---

## Phase 6: GitHub Actions (if GitHub Pages)

**If hosting is GitHub Pages, create workflow:**

```yaml
# .github/workflows/docs.yml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'website/**'
      - 'docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
        working-directory: website
      - name: Build
        run: npm run build
        working-directory: website
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website/build
```

---

## Success Message

```
"Documentation site initialized for this project!

Created:
- docs/.diataxis.md (project configuration)
- [website/ | docs/] (documentation structure)
- [.github/workflows/docs.yml] (if GitHub Pages)

Your configuration:
- Purpose: [chosen purpose]
- Technology: [chosen tech]
- Primary audience: [primary role]

Next steps:
- 'Plan documentation for this project' - analyze gaps
- 'Create a tutorial for getting started' - write content
- 'Organize existing docs' - restructure if you have existing content"
```

---

## References

- `Standard.md` - Diataxis framework documentation
- `PlanDocumentation.md` - Next step after initialization
- `CreateDocumentation.md` - Writing new content
