#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/michelvidailhet/Documents/Projects/perso/media-manager"
PROMPT_FILE="$PROJECT_DIR/.codex/automations/nightly-ready-for-agent-prompt.md"
LOG_DIR="$HOME/.codex/automations/nightly-ready-for-agent-implementation"
LOG_FILE="$LOG_DIR/launchd.log"
CODEX_BIN="/Applications/Codex.app/Contents/Resources/codex"
MAX_ISSUES="${MAX_ISSUES:-5}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$LOG_DIR"

{
  echo
  echo "===== nightly-ready-for-agent $(date -u '+%Y-%m-%dT%H:%M:%SZ') ====="
  cd "$PROJECT_DIR"

  gh auth status
  READY_ISSUES=()
  while IFS= read -r issue_number; do
    READY_ISSUES+=("$issue_number")
  done < <(
    gh issue list \
      --repo mvidailhet/media-manager \
      --label ready-for-agent \
      --state open \
      --limit "$MAX_ISSUES" \
      --json number \
      --jq '.[].number'
  )

  if [[ "${#READY_ISSUES[@]}" -eq 0 ]]; then
    echo "No ready-for-agent issues found."
    exit 0
  fi

  echo "Found ${#READY_ISSUES[@]} ready-for-agent issue(s), capped at MAX_ISSUES=$MAX_ISSUES."

  for issue_number in "${READY_ISSUES[@]}"; do
    issue_log_file="$LOG_DIR/issue-$issue_number.log"
    echo
    echo "----- issue #$issue_number start $(date -u '+%Y-%m-%dT%H:%M:%SZ') -----"

    sed "s/ISSUE_NUMBER/#$issue_number/g" "$PROMPT_FILE" | "$CODEX_BIN" exec \
      --cd "$PROJECT_DIR" \
      --sandbox danger-full-access \
      --dangerously-bypass-approvals-and-sandbox \
      --model gpt-5.5 \
      -c model_reasoning_effort='"medium"' \
      - >> "$issue_log_file" 2>&1

    echo "----- issue #$issue_number end $(date -u '+%Y-%m-%dT%H:%M:%SZ') -----"
    echo "Issue #$issue_number log: $issue_log_file"
  done
} >> "$LOG_FILE" 2>&1
