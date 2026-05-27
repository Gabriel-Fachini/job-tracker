#!/bin/bash
# Project health check at session start.
cd /Users/gabriel_fachini/Desktop/repos/job-tracker || exit 0

msgs=()

# Git status
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
[ "$dirty" != "0" ] && msgs+=("Git: $dirty uncommitted change(s)")

# Dev server on :3000
if lsof -ti:3000 >/dev/null 2>&1; then
  msgs+=("Dev server detected on :3000 (user-managed — do not start npm run dev)")
else
  msgs+=("No dev server on :3000 — ask user to start if needed")
fi

# Latest backup age
latest=$(ls -t backups/daily/*.db.gz 2>/dev/null | head -1)
if [ -n "$latest" ]; then
  age_h=$(( ( $(date +%s) - $(stat -f %m "$latest") ) / 3600 ))
  if [ "$age_h" -gt 24 ]; then
    msgs+=("WARN: latest DB backup is ${age_h}h old (>24h) — run 'npm run db:backup' before schema changes")
  fi
else
  msgs+=("WARN: no DB backup found in backups/daily/")
fi

# Env vars (Ollama cloud required)
envfile=""
[ -f .env.local ] && envfile=.env.local
[ -z "$envfile" ] && [ -f .env ] && envfile=.env
if [ -z "$envfile" ]; then
  msgs+=("WARN: no .env / .env.local found")
else
  for v in OLLAMA_RUNTIME_MODE OLLAMA_BASE_URL OLLAMA_MODEL OLLAMA_API_KEY; do
    grep -qE "^${v}=" "$envfile" || msgs+=("WARN: missing env var ${v} in ${envfile}")
  done
fi

if [ ${#msgs[@]} -gt 0 ]; then
  joined=$(printf '%s\n' "${msgs[@]}")
  jq -nc --arg ctx "Project health check:
${joined}" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
fi
exit 0
