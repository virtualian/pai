# MARR Project Configuration

This directory contains MARR (Making Agents Really Reliable) configuration for this project.

## Structure

```
.claude/marr/
├── MARR-PROJECT-CLAUDE.md   # Project-specific AI agent configuration
├── README.md                # This file
└── standards/               # Project-level standards (optional)
    ├── prj-development-workflow-standard.md
    ├── prj-version-control-standard.md
    ├── prj-testing-standard.md
    └── ...
```

## How It Works

1. Project root `CLAUDE.md` imports `@.claude/marr/MARR-PROJECT-CLAUDE.md`
2. MARR-PROJECT-CLAUDE.md defines trigger conditions for standards
3. When a trigger is met, the AI agent reads that standard before proceeding

## Customization

Edit files in this directory to match your project's needs. Changes are version-controlled with your project.

## Commands

- `marr validate` - Check configuration is correct
- `marr standard list` - List installed standards
- `marr standard sync` - Regenerate trigger list from frontmatter
