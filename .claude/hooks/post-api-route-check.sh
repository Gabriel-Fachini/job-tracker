#!/bin/bash
# Sanity check for Next.js App Router route handlers.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$file_path" in
  */src/app/api/*/route.ts|*/src/app/api/*/route.tsx) ;;
  *) exit 0 ;;
esac

[ -f "$file_path" ] || exit 0

warnings=()

# Must export at least one HTTP method
if ! grep -qE "^export (async )?function (GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)" "$file_path"; then
  warnings+=("No HTTP method export found (expected GET/POST/PUT/DELETE/PATCH/OPTIONS/HEAD)")
fi

# SSE / streaming requires nodejs runtime + dynamic
if grep -qE "text/event-stream|ReadableStream" "$file_path"; then
  grep -q 'export const runtime' "$file_path" \
    || warnings+=("SSE/stream detected — missing 'export const runtime = \"nodejs\"'")
  grep -q 'export const dynamic' "$file_path" \
    || warnings+=("SSE/stream detected — missing 'export const dynamic = \"force-dynamic\"'")
fi

# Next 15+: params must be Promise and awaited
if grep -qE "\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{" "$file_path"; then
  warnings+=("Possible sync 'params' destructuring — Next 15+ requires 'params: Promise<{...}>' with await")
fi

if [ ${#warnings[@]} -gt 0 ]; then
  joined=$(printf -- '- %s\n' "${warnings[@]}")
  jq -nc --arg ctx "API route sanity warnings for ${file_path}:
${joined}" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi
exit 0
