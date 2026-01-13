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
```

**If `./docs/.diataxis.md` exists:** Skip to other workflows (PlanDocumentation, CreateDocumentation, etc.)

**If not:** Run this initialization workflow.

---

## Phase 1: Source Discovery (Automatic)

**CRITICAL:** Thoroughly analyze the project BEFORE asking any questions. This analysis informs all recommendations.

### 1.1 Project Type & Repo Detection

```bash
# Detect project type and ecosystem
if [ -f "package.json" ]; then
  echo "PROJECT_TYPE: Node.js"
  cat package.json | head -30
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
  echo "PROJECT_TYPE: Python"
elif [ -f "go.mod" ]; then
  echo "PROJECT_TYPE: Go"
elif [ -f "Cargo.toml" ]; then
  echo "PROJECT_TYPE: Rust"
elif [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
  echo "PROJECT_TYPE: Java"
else
  echo "PROJECT_TYPE: Unknown"
fi

# Check repo visibility (for hosting recommendations)
if command -v gh &> /dev/null && [ -d ".git" ]; then
  REPO_VISIBILITY=$(gh repo view --json visibility -q '.visibility' 2>/dev/null || echo "unknown")
  echo "REPO_VISIBILITY: $REPO_VISIBILITY"
else
  echo "REPO_VISIBILITY: unknown (gh CLI not available or not a git repo)"
fi
```

### 1.2 Source Inventory

Scan for ALL potential documentation sources:

```bash
echo "=== SOURCE INVENTORY ==="

# Existing documentation
if [ -d "./docs" ]; then
  DOC_COUNT=$(find ./docs -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "EXISTING_DOCS: Yes ($DOC_COUNT markdown files)"
  find ./docs -name "*.md" -type f | head -20
else
  echo "EXISTING_DOCS: No"
fi

# README files
README_COUNT=$(find . -maxdepth 3 -name "README*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "README_FILES: $README_COUNT"
[ -f "README.md" ] && echo "  - README.md ($(wc -l < README.md) lines)"

# Code comments (sample check)
if [ -d "./src" ] || [ -d "./lib" ]; then
  # Check for JSDoc/TSDoc
  JSDOC_COUNT=$(grep -r "^\s*/\*\*" --include="*.ts" --include="*.js" . 2>/dev/null | wc -l | tr -d ' ')
  echo "JSDOC_COMMENTS: $JSDOC_COUNT blocks found"

  # Check for Python docstrings
  DOCSTRING_COUNT=$(grep -r '"""' --include="*.py" . 2>/dev/null | wc -l | tr -d ' ')
  echo "PYTHON_DOCSTRINGS: $DOCSTRING_COUNT found"
fi

# API specifications
[ -f "openapi.yaml" ] || [ -f "openapi.json" ] || [ -f "swagger.yaml" ] && echo "OPENAPI_SPEC: Yes"
[ -f "api.md" ] || [ -d "./api" ] && echo "API_DOCS: Yes"

# External specs
[ -d "./specs" ] || [ -d "./rfcs" ] || [ -d "./design" ] && echo "DESIGN_DOCS: Yes"

# Existing website/docs site
[ -f "docusaurus.config.js" ] && echo "EXISTING_SITE: Docusaurus"
[ -f "mkdocs.yml" ] && echo "EXISTING_SITE: MkDocs"

echo "=== END INVENTORY ==="
```

### 1.3 Present Findings

Before asking questions, present what you found:

```
"I've analyzed your project and found:

🔧 Project type: [Node.js | Python | Go | etc.]
🔒 Repo visibility: [Public | Private | Unknown]

📁 Existing docs/: [Yes (N files) | No]
📄 README files: [N files]
💬 Code comments: [JSDoc: N | Docstrings: N | None detected]
📋 API specs: [OpenAPI found | None]
📐 Design docs: [Yes | No]
🌐 Existing docs site: [Docusaurus | MkDocs | None]

Based on this, I'll make recommendations as we configure your documentation.
Note: Private repos require GitHub Enterprise for GitHub Pages, or use Vercel/Netlify instead."
```

---

## Phase 2: User Questions

**IMPORTANT:** Ask ALL 6 questions in this order. Each question builds on previous answers AND the source analysis from Phase 1.

### Question Order (Dependencies)

```
Sources (confirm what was found)
    ↓
Purpose (informed by sources)
    ↓
Roles (informed by purpose + sources)
    ↓
Diataxis Priorities (informed by roles + sources)
    ↓
Technology (informed by purpose + sources + project type)
    ↓
Hosting (informed by technology + project setup)
```

---

### Question 1: Sources (Confirmation)

**Present sources found in Phase 1 and confirm which to use.**

```json
{
  "header": "Sources",
  "question": "I found these potential documentation sources. Which should we use?",
  "multiSelect": true,
  "options": [
    {"label": "Existing docs/ (Recommended)", "description": "[N files found] - Current documentation directory"},
    {"label": "Code comments", "description": "[N JSDoc/docstrings found] - Extract from inline documentation"},
    {"label": "README files", "description": "[N found] - Project and package READMEs"},
    {"label": "API specifications", "description": "[OpenAPI/Swagger found] - Generate reference docs"},
    {"label": "Design documents", "description": "[specs/, rfcs/ found] - Architecture and design docs"}
  ]
}
```

**Dynamic options:** Only show options for sources that were actually found. Mark found sources as recommended.

---

### Question 2: Purpose

**Recommend based on sources found.**

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

**Recommendation logic based on sources:**

| Sources Found | Recommended Purpose |
|--------------|---------------------|
| OpenAPI spec, JSDoc, API code | Developer Portal |
| User-facing app, no API | Product Documentation |
| Internal tooling, runbooks | Internal/Team Docs |
| GitHub public repo, CONTRIBUTING.md | Open Source Project |

---

### Question 3: Roles/Audiences

**Recommend based on purpose + sources.**

```json
{
  "header": "Roles",
  "question": "What roles/audiences does your documentation serve?",
  "multiSelect": true,
  "options": [
    {"label": "Developers", "description": "People writing code against your project"},
    {"label": "Users", "description": "End users of your application or library"},
    {"label": "Operators", "description": "DevOps, SRE, people deploying and running your system"},
    {"label": "Contributors", "description": "Open source contributors to your project"}
  ]
}
```

**Recommendation logic:**

| Purpose | Recommended Roles |
|---------|-------------------|
| Developer Portal | Developers (primary), Operators |
| Product Documentation | Users (primary), Operators |
| Internal/Team Docs | Developers, Operators |
| Open Source Project | Developers, Contributors |

---

### Question 4: Diataxis Priorities

**Ask for EACH role selected. Recommendations based on available sources.**

```json
{
  "header": "[Role] Docs",
  "question": "For [ROLE], which Diataxis content types are most important?",
  "multiSelect": true,
  "options": [
    {"label": "How-to Guides", "description": "Task-oriented guides for accomplishing specific goals"},
    {"label": "Reference", "description": "Technical specifications, API docs, configuration options"},
    {"label": "Tutorials", "description": "Learning-oriented content for newcomers"},
    {"label": "Explanation", "description": "Conceptual content explaining why things work"}
  ]
}
```

**Recommendation logic based on sources:**

| Source Available | Can Recommend |
|-----------------|---------------|
| OpenAPI spec, JSDoc | Reference ✓ |
| Existing tutorials in docs/ | Tutorials ✓ |
| Code examples | How-to Guides ✓ |
| Design docs, architecture | Explanation ✓ |

**If source doesn't exist for a content type, note it:**
```
"Note: Reference docs recommended, but I didn't find API specs or JSDoc.
You'll need to add code comments or manually write reference content."
```

---

### Question 5: Technology

**Recommend based on purpose + sources + project type.**

```json
{
  "header": "Technology",
  "question": "Which documentation technology should we use?",
  "multiSelect": false,
  "options": [
    {"label": "Docusaurus", "description": "React-based, versioning, search, MDX support - great for developer portals"},
    {"label": "MkDocs + Material", "description": "Python-based, clean design, simpler setup - great for technical docs"},
    {"label": "Astro Starlight", "description": "Fast, modern, component islands - great for performance"},
    {"label": "Plain Markdown", "description": "No build step, GitHub renders directly - great for simple projects"}
  ]
}
```

**Recommendation logic:**

| Factors | Recommended Technology |
|---------|----------------------|
| Node.js project + Developer Portal | Docusaurus |
| Python project + any purpose | MkDocs Material |
| Existing Docusaurus setup | Docusaurus (keep existing) |
| Existing MkDocs setup | MkDocs (keep existing) |
| Small project, few docs | Plain Markdown |
| Performance critical | Astro Starlight |

---

### Question 6: Hosting

**Recommend based on technology + project setup.**

```json
{
  "header": "Hosting",
  "question": "Where will your documentation be hosted?",
  "multiSelect": false,
  "options": [
    {"label": "GitHub Pages", "description": "Free, git-integrated, works with most static site generators"},
    {"label": "Vercel/Netlify", "description": "Modern JAMstack hosting with preview deployments"},
    {"label": "Self-hosted", "description": "Your own infrastructure (nginx, S3, etc.)"},
    {"label": "Docs platform", "description": "ReadMe, GitBook, Notion, or similar managed platform"}
  ]
}
```

**Recommendation logic:**

| Factors | Recommended Hosting |
|---------|-------------------|
| Public GitHub repo | GitHub Pages (free, integrated) |
| Private repo (no Enterprise) | Vercel/Netlify (free tier available) |
| Private repo + GitHub Enterprise | GitHub Pages or Vercel/Netlify |
| Enterprise/on-prem requirements | Self-hosted |
| Managed experience preferred | Docs platform (ReadMe, GitBook) |

**Note:** GitHub Pages requires public repos OR GitHub Enterprise subscription for private repos.

---

## Phase 3: Scaffold Documentation Site

Based on technology choice, scaffold the docs site:

### Docusaurus

```bash
# Create Docusaurus site in website/
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
mkdir -p docs
pip install mkdocs-material  # or add to requirements.txt
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

## Documentation Sources

1. [source 1]
2. [source 2]
3. [source 3]

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

Based on role priorities and available sources, create starter files:

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
- Sources: [list of selected sources]

Next steps:
- 'Plan documentation for this project' - analyze gaps based on sources
- 'Create a tutorial for getting started' - write content
- 'Organize existing docs' - restructure if you have existing content"
```

---

## References

- `Standard.md` - Diataxis framework documentation
- `PlanDocumentation.md` - Next step after initialization
- `CreateDocumentation.md` - Writing new content
