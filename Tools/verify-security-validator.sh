#!/usr/bin/env bash
# verify-security-validator.sh
#
# Behaviour-level smoke test for SecurityValidator.hook.ts. Proves that the
# hook actually blocks dangerous patterns rather than silently fail-opening.
# Issue #158 background: the hook went silently no-op from v4.0.0+ because
# (a) the `yaml` package wasn't resolvable from ~/.pai/hooks/ and
# (b) patterns.example.yaml was no longer shipped. This script is the
# regression guard.
#
# Usage:  bash Tools/verify-security-validator.sh
# Exit:   0 if all checks pass, non-zero otherwise.
#
# Payloads are routed via tmp-file stdin so no command line literally
# contains a blocked-pattern substring (otherwise the wrapper command
# itself trips the hook before the test runs).

set -u

PAI_DIR="${PAI_DIR:-$HOME/.pai}"
HOOK="$PAI_DIR/hooks/SecurityValidator.hook.ts"
PATTERNS="$PAI_DIR/PAI/PAISECURITYSYSTEM/patterns.example.yaml"
PKG_JSON="$PAI_DIR/package.json"
YAML_MOD="$PAI_DIR/node_modules/yaml"

PASS=0
FAIL=0
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
ok()    { printf '  [%s] %s\n' "$(green PASS)" "$1"; PASS=$((PASS+1)); }
ng()    { printf '  [%s] %s\n' "$(red FAIL)" "$1"; FAIL=$((FAIL+1)); }

run_hook() {
  bun run "$HOOK" < "$1" 2>&1
}

echo
echo "── Prerequisites ──────────────────────────────────────"
[ -f "$HOOK" ]      && ok "hook present at $HOOK"          || { ng "hook missing"; echo; exit 1; }
[ -f "$PATTERNS" ]  && ok "patterns at $PATTERNS"          || ng "patterns.example.yaml missing"
[ -f "$PKG_JSON" ]  && ok "package.json at $PKG_JSON"      || ng "package.json missing"
[ -d "$YAML_MOD" ]  && ok "yaml node_module at $YAML_MOD"  || ng "node_modules/yaml/ missing — run: cd $PAI_DIR && bun install"

echo
echo "── Behaviour tests ────────────────────────────────────"

# T1 — rm -rf / blocks (exit 2). Build the command via concat so this script's
# own command line never contains the literal blocked substring (which would
# trip the hook before the test could run).
python3 -c 'import json; print(json.dumps({"session_id":"verify","tool_name":"Bash","tool_input":{"command":"r"+"m -rf /"}}))' > "$TMPDIR/t1.json"
out=$(run_hook "$TMPDIR/t1.json"); rc=$?
if [ "$rc" = "2" ] && echo "$out" | grep -q "BLOCKED"; then
  ok "rm -rf / -> exit 2 (BLOCKED)"
else
  ng "rm -rf / expected exit 2 BLOCKED, got rc=$rc out=$out"
fi

# T2 — Read of ~/.ssh/id_rsa blocks (exit 2)
python3 -c 'import os,json; print(json.dumps({"session_id":"verify","tool_name":"Read","tool_input":{"file_path": os.path.expanduser("~")+"/.ssh/id_rsa"}}))' \
  > "$TMPDIR/t2.json"
out=$(run_hook "$TMPDIR/t2.json"); rc=$?
if [ "$rc" = "2" ] && echo "$out" | grep -q "Zero access"; then
  ok "Read ~/.ssh/id_rsa -> exit 2 (Zero access)"
else
  ng "Read ~/.ssh/id_rsa expected exit 2, got rc=$rc out=$out"
fi

# T3 — safe command continues (exit 0, {continue:true})
printf '%s' '{"session_id":"verify","tool_name":"Bash","tool_input":{"command":"echo hello"}}' > "$TMPDIR/t3.json"
out=$(run_hook "$TMPDIR/t3.json"); rc=$?
if [ "$rc" = "0" ] && echo "$out" | grep -q '"continue":true'; then
  ok "echo hello -> exit 0 {continue:true}"
else
  ng "echo hello expected exit 0 continue, got rc=$rc out=$out"
fi

# T4 — git push --force prompts (exit 0, {decision:"ask"})
printf '%s' '{"session_id":"verify","tool_name":"Bash","tool_input":{"command":"git push --force"}}' > "$TMPDIR/t4.json"
out=$(run_hook "$TMPDIR/t4.json"); rc=$?
if [ "$rc" = "0" ] && echo "$out" | grep -q '"decision":"ask"'; then
  ok "git push --force -> exit 0 {decision:ask}"
else
  ng "git push --force expected exit 0 ask, got rc=$rc out=$out"
fi

echo
echo "── Result ─────────────────────────────────────────────"
echo "  PASS=$PASS  FAIL=$FAIL"
echo
[ "$FAIL" = "0" ]
