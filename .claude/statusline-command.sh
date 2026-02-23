#!/bin/bash
# PAI Status Line — Minimal with toggle support
#
# Modes (set in settings.json → statusline.mode):
#   "minimal" (default) — single-line compact display
#   "full"              — original PAI statusline with all sections
#
# Layout: Context% FolderName BranchName #PR

set -o pipefail

PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SETTINGS_FILE="$PAI_DIR/settings.json"

# ── Mode toggle ───────────────────────────────────────────────────────────────

sl_mode=$(jq -r '.statusline.mode // "minimal"' "$SETTINGS_FILE" 2>/dev/null)
sl_mode="${sl_mode:-minimal}"

if [ "$sl_mode" = "full" ] && [ -f "$PAI_DIR/statusline-full.sh" ]; then
    exec bash "$PAI_DIR/statusline-full.sh"
fi

# ── Parse input JSON ──────────────────────────────────────────────────────────

input=$(cat)

eval "$(echo "$input" | jq -r '
  "context_pct=" + (.context_window.used_percentage // 0 | tostring) + "\n" +
  "current_dir=" + (.workspace.current_dir // .cwd | @sh)
')"

# ── Context color ─────────────────────────────────────────────────────────────

[ "$context_pct" -gt 100 ] && context_pct=100

if [ "$context_pct" -lt 60 ]; then
    pct_color='\033[38;2;74;222;128m'    # emerald <60%
elif [ "$context_pct" -lt 80 ]; then
    pct_color='\033[38;2;251;191;36m'    # amber 60-79%
else
    pct_color='\033[38;2;251;113;133m'   # rose 80%+
fi

# ── Project folder + Git branch ───────────────────────────────────────────────

folder_name=$(basename "$current_dir")

branch=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    branch=$(git branch --show-current 2>/dev/null || echo "detached")
fi

# ── Output (single line) ─────────────────────────────────────────────────────

RST='\033[0m'
DIM='\033[38;2;148;163;184m'
BLUE='\033[38;2;96;165;250m'

printf "${pct_color}${context_pct}%%${RST} ${BLUE}${folder_name}${RST}"
[ -n "$branch" ] && printf " ${DIM}${branch}${RST}"
printf "\n"
