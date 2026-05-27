#!/bin/bash
# Reminder when editing Drizzle schema.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  */src/lib/db/schema.ts)
    jq -nc --arg ctx "Schema edit detected (src/lib/db/schema.ts).
BEFORE applying changes: run 'npm run db:backup' (per CLAUDE.md).
AFTER edit: run 'npm run db:generate' then 'npm run db:migrate'.
Confirm backup exists in backups/daily/ before proceeding." \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'
    ;;
esac
exit 0
