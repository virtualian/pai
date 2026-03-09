<p align="center">
  <img src="utilities-icon.png" alt="PAI Utilities" width="128">
</p>

# Utilities

> **FOR AI AGENTS:** This directory contains tools for maintaining PAI installations.

---

## Contents

### validate-protected.ts

**Security Validation**

Validates that PAI repository files don't contain sensitive data before committing. Used by the pre-commit hook automatically.

### BackupRestore.ts

**Backup and Restore**

Create and restore backups of PAI installations.

```bash
bun BackupRestore.ts backup                    # Create timestamped backup
bun BackupRestore.ts backup --name "pre-v3"    # Named backup
bun BackupRestore.ts list                      # List backups
bun BackupRestore.ts restore <backup-name>     # Restore
```

### UpgradeCheck.ts

**Pre-Upgrade Patch Analysis**

Analyzes locally patched files against a target release. Classifies each active patch as SAFE (carries forward), CONFLICT (merge needed), or RETIRE (upstream fixed it). Requires `LOCAL_PATCHES.md` in your PAI installation directory.

```bash
bun Tools/UpgradeCheck.ts v4.0.3              # Analyze patches against v4.0.3
bun Tools/UpgradeCheck.ts v4.0.3 --backup     # Analyze + create backup first
bun Tools/UpgradeCheck.ts v4.0.3 --no-gh      # Skip GitHub API calls
bun Tools/UpgradeCheck.ts v4.0.3 --repo ~/pai # Custom repo path
```

### UpstreamScan.ts

**Upstream Repository Monitor**

Monitors the upstream PAI repo for new issues, PRs, and discussions. Uses disposition-based tracking to avoid re-processing already-decided items while surfacing new activity. Requires `UPSTREAM-DIGEST.json` in your PAI installation directory.

```bash
bun Tools/UpstreamScan.ts                           # Full scan
bun Tools/UpstreamScan.ts --author myuser           # Set GitHub username
bun Tools/UpstreamScan.ts --no-gh                   # Report digest state only
bun Tools/UpstreamScan.ts --keywords-file kw.json   # Custom relevance keywords
```

**Configuration:** Set `PAI_GITHUB_USER` env var for persistent author config.

### ScanWorkflow.md

**Upstream Scan Workflow Guide**

Step-by-step workflow for LLM assistants to run upstream scans, deep-dive relevant items, produce structured reports, and collect user decisions. Designed to be read by the DA during scan operations.

### templates/

Template files for initializing local patch tracking:

| Template | Copy To | Purpose |
|----------|---------|---------|
| `LOCAL_PATCHES-TEMPLATE.md` | `~/.claude/LOCAL_PATCHES.md` | Track local modifications to SYSTEM files |
| `UPSTREAM-DIGEST-TEMPLATE.json` | `~/.claude/UPSTREAM-DIGEST.json` | Initialize upstream scan state |

---

## Quick Reference

| File | Purpose |
|------|---------|
| validate-protected.ts | Validate no sensitive data in commits |
| BackupRestore.ts | Backup and restore PAI installations |
| UpgradeCheck.ts | Pre-upgrade patch analysis (SAFE/CONFLICT/RETIRE) |
| UpstreamScan.ts | Upstream repo monitoring with disposition tracking |
| ScanWorkflow.md | LLM workflow guide for upstream scans |

---

*Part of the [PAI (Personal AI Infrastructure)](https://github.com/danielmiessler/PAI) project.*
