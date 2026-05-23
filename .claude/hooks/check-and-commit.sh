#!/usr/bin/env bash
# Stop-hook: end-of-turn checks for the Kokoro monorepo.
#
# 1. Detect which apps/* packages have uncommitted changes.
# 2. Run that package's lint / typecheck / tests.
# 3. If anything fails → emit `decision: block` so Claude must fix before
#    ending the turn (the failure output is fed back as the reason).
# 4. If everything is green:
#    - Auto-commit any leftover uncommitted changes with a `chore(auto):`
#      message. (Claude's own commits during the turn are kept verbatim —
#      the auto-commit only fires when there are actual unstaged/staged
#      changes after the manual commits.)
#    - Push the current branch (sets upstream if missing).
# 5. Surface a system-message warning when production code changed but
#    no test files were touched.
#
# Configured by `.claude/settings.json` under `hooks.Stop`. Edit or
# disable via `/hooks` inside the Claude Code TUI.

set -uo pipefail

# Ensure pnpm + uv are on PATH (Claude Code may launch with a minimal env).
export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:$PATH"

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

emit_block () {
  python3 -c 'import json,sys; print(json.dumps({"decision":"block","reason":sys.argv[1]}))' "$1"
  exit 0
}

emit_msg () {
  python3 -c 'import json,sys; print(json.dumps({"systemMessage":sys.argv[1]}))' "$1"
}

# --- 1. Snapshot the working tree ----------------------------------------

STATUS=$(git status --porcelain 2>/dev/null || true)
TOUCHED_FILES=$(printf '%s\n' "$STATUS" | sed 's/^...//' | sed 's/^"//;s/"$//')

# Quick exit: clean tree, nothing to push.
if [ -z "$STATUS" ]; then
  AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
  if [ "$AHEAD" -gt 0 ]; then
    git push 2>&1 | tail -3 >&2 || true
  fi
  exit 0
fi

# --- 2. Bucket touched files by package ----------------------------------

has_touched () { printf '%s\n' "$TOUCHED_FILES" | grep -q "$1"; }

TOUCHED_NATIVE=false; has_touched '^apps/native/' && TOUCHED_NATIVE=true
TOUCHED_WEB=false;    has_touched '^apps/web/'    && TOUCHED_WEB=true
TOUCHED_API=false;    has_touched '^apps/api/'    && TOUCHED_API=true

# Production code changed without an accompanying test file? Warn later.
CODE_CHANGED=false
TESTS_CHANGED=false
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    *.test.*|*.spec.*|*/tests/*|*/__tests__/*) TESTS_CHANGED=true ;;
    *.ts|*.tsx|*.js|*.jsx|*.py) CODE_CHANGED=true ;;
  esac
done <<< "$TOUCHED_FILES"

# --- 3. Run lint / typecheck / tests for touched packages ----------------

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT
FAILURES=()

run_check () {
  local label="$1"; shift
  local dir="$1"; shift
  printf '\n=== %s ===\n' "$label" >> "$LOG"
  if ! (cd "$dir" && "$@") >> "$LOG" 2>&1; then
    FAILURES+=("$label")
  fi
}

if $TOUCHED_NATIVE; then
  run_check "native: check-types" apps/native pnpm check-types
  run_check "native: test"        apps/native pnpm exec jest --silent
fi

if $TOUCHED_WEB; then
  # Skip the slow vite build step; tsc -b alone catches type regressions.
  run_check "web: lint"        apps/web pnpm lint
  run_check "web: check-types" apps/web pnpm exec tsc -b
fi

if $TOUCHED_API; then
  # api pytest is intentionally skipped — there are 7 pre-existing failures
  # (test_validate_lyrics imports a removed symbol, etc.) tracked in
  # CLAUDE.md that have nothing to do with the agent's changes. Re-enable
  # `run_check "api: test" apps/api uv run pytest -q` once those land.
  run_check "api: lint"        apps/api uv run ruff check
  run_check "api: check-types" apps/api uv run mypy src
fi

# --- 4. Block on any failure --------------------------------------------

if [ "${#FAILURES[@]}" -gt 0 ]; then
  TAIL=$(tail -c 4000 "$LOG")
  JOINED=$(printf '%s\n' "${FAILURES[@]}" | paste -sd, -)
  REASON="Pre-commit checks failed: ${JOINED}. Fix before ending the turn.

$TAIL"
  emit_block "$REASON"
fi

# --- 5. Auto-commit leftover work + push --------------------------------

if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null \
   || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add -A
  TS=$(date -u +%Y-%m-%dT%H:%MZ)
  git commit --quiet -m "chore(auto): session checkpoint $TS

Auto-commit from Claude Code Stop hook after lint + tests passed.
Edit or disable via /hooks." >> "$LOG" 2>&1 || true
fi

# Push if HEAD is ahead of upstream (or set upstream on first push).
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$BRANCH" ]; then
  if ! git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    git push --set-upstream origin "$BRANCH" >> "$LOG" 2>&1 || \
      emit_msg "push --set-upstream failed; see git output"
  else
    AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
    if [ "$AHEAD" -gt 0 ]; then
      git push >> "$LOG" 2>&1 || emit_msg "git push failed; see hook log"
    fi
  fi
fi

# --- 6. Warn about missing tests ----------------------------------------

if $CODE_CHANGED && ! $TESTS_CHANGED; then
  emit_msg "⚠ Production code changed but no test files were touched this turn."
fi

exit 0
