#!/bin/bash
# Incremental TS typecheck after edits. Reports errors ONLY in the edited file.
# Agent instruction: fix only errors in files you modified this turn.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip declaration files and node_modules
case "$file_path" in
  *.d.ts) exit 0 ;;
  */node_modules/*) exit 0 ;;
esac

project_root="/Users/gabriel_fachini/Desktop/repos/job-tracker"
case "$file_path" in
  "$project_root"/*) ;;
  *) exit 0 ;;
esac

cd "$project_root" || exit 0
rel="${file_path#${project_root}/}"

# Incremental tsc; cache lives in node_modules/.cache or .tsbuildinfo
# Use timeout to avoid blocking >30s
output=$(timeout 30 npx --no-install tsc --noEmit --incremental 2>&1)
status=$?

if [ $status -eq 124 ]; then
  # Timeout — skip silently
  exit 0
fi

# Filter to errors mentioning this file only
errors=$(printf '%s\n' "$output" | grep -F "$rel" | head -30)

if [ -n "$errors" ]; then
  jq -nc --arg ctx "Typecheck errors in ${rel} (fix ONLY these — do not chase unrelated cascade errors in other files):
${errors}" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi
exit 0
