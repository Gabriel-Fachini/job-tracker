#!/usr/bin/env bash
# Pull-based auto-deploy: builds origin/main in a fresh release directory and only switches the
# active version when build, migrations and health check succeed. Otherwise the current version
# keeps running.
#
# Installed as /usr/local/sbin/job-tracker-deploy by deploy/install.sh and run as root by
# job-tracker-deploy.timer. Every step that executes repository code (npm, build, migrations)
# runs as APP_USER, never as root. Changes to this file only take effect after re-running
# install.sh, so a push to main cannot change what runs as root.
#
# Usage: job-tracker-deploy            deploy origin/main if it changed
#        FORCE=1 job-tracker-deploy    redeploy even if unchanged or previously failed
set -euo pipefail

APP_USER="jobtracker"
APP_HOME="/var/lib/job-tracker"
BASE_DIR="/srv/job-tracker"
REPO_DIR="$BASE_DIR/repo"
RELEASES_DIR="$BASE_DIR/releases"
CURRENT_LINK="$BASE_DIR/current"
FAILED_MARKER="$BASE_DIR/.last-failed-sha"
ENV_FILE="/etc/job-tracker/env"
PRE_DEPLOY_BACKUP_DIR="$APP_HOME/backups/pre-deploy"
SERVICE="job-tracker.service"
APP_URL="http://127.0.0.1:3000"
BRANCH="main"
KEEP_RELEASES=3
KEEP_PRE_DEPLOY_BACKUPS=5
MAX_WAIT_FOR_RUN_SECONDS=1800

log() { echo "[deploy] $*"; }

as_app() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" "$@"; }

# Runs a command inside the new release with the app env loaded (DATABASE_URL etc.).
in_release() {
  as_app bash -c 'set -e; set -a; . "$1"; set +a; cd "$2"; shift 2; exec "$@"' _ "$ENV_FILE" "$release" "$@"
}

fail() {
  log "FAILED: $1 — keeping current version"
  echo "$target_sha" > "$FAILED_MARKER"
  rm -rf "$release"
  exit 1
}

# Server config problems are not the commit's fault: no failure marker, so the next tick
# deploys on its own once the config is fixed.
abort() {
  log "ABORTED: $1 — keeping current version"
  exit 1
}

switch_to() {
  as_app ln -sfn "$1" "$CURRENT_LINK.new"
  as_app mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"
}

wait_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 5 "$APP_URL/dashboard"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Restarting mid-scan would kill the monitoring run, so wait for it to finish first.
run_in_progress() {
  local body
  body="$(curl -fsS --max-time 5 "$APP_URL/api/monitoring/current" 2>/dev/null || true)"
  [[ "$body" == *'"status":"running"'* ]]
}

wait_for_idle_run() {
  local waited=0
  while run_in_progress; do
    if (( waited >= MAX_WAIT_FOR_RUN_SECONDS )); then
      return 1
    fi
    if (( waited == 0 )); then
      log "monitoring run in progress; waiting before restart"
    fi
    sleep 30
    waited=$(( waited + 30 ))
  done
}

exec 9>/run/job-tracker-deploy.lock
if ! flock -n 9; then
  log "another deploy is running; skipping"
  exit 0
fi

as_app git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
target_sha="$(as_app git -C "$REPO_DIR" rev-parse "origin/$BRANCH")"
current_sha="$(cat "$CURRENT_LINK/.release-sha" 2>/dev/null || true)"

if [[ "${FORCE:-0}" != "1" ]]; then
  # Nothing new, or this commit already failed: wait for the next commit (or FORCE=1).
  if [[ "$target_sha" == "$current_sha" ]] || [[ "$target_sha" == "$(cat "$FAILED_MARKER" 2>/dev/null || true)" ]]; then
    exit 0
  fi
fi

# Fail closed on a broken env: never build or migrate against a database that does not exist
# (sqlite3/drizzle would silently create an empty one).
db_path="$(as_app bash -c 'set -e; set -a; . "$1"; printf "%s" "${DATABASE_URL:-}"' _ "$ENV_FILE")" \
  || abort "cannot load $ENV_FILE"
if [[ "$db_path" != /* ]]; then
  abort "DATABASE_URL in $ENV_FILE must be an absolute path (got '$db_path')"
fi
if [[ ! -f "$db_path" ]]; then
  abort "database not found at $db_path (DATABASE_URL in $ENV_FILE)"
fi

release="$RELEASES_DIR/$(date +%Y%m%d-%H%M%S)-${target_sha:0:7}"
log "deploying ${target_sha:0:7} (current: ${current_sha:0:7}) → $release"

as_app mkdir -p "$release"
as_app bash -c 'set -o pipefail; git -C "$1" archive "$2" | tar -x -C "$3"' _ "$REPO_DIR" "$target_sha" "$release" || fail "git archive"
as_app bash -c 'echo "$1" > "$2/.release-sha"' _ "$target_sha" "$release"

# npm ci runs without the app env so dependency install scripts never see the secrets.
as_app bash -c 'cd "$1" && npm ci --no-audit --no-fund' _ "$release" || fail "npm ci"
# System libraries for Chromium (playwright install-deps) need root and stay a manual step.
as_app bash -c 'cd "$1" && npx playwright install chromium' _ "$release" || fail "playwright install"
in_release npm run build || fail "build"

# Wait before migrating so migrations and the switch happen back to back.
if ! wait_for_idle_run; then
  log "monitoring run still active after ${MAX_WAIT_FOR_RUN_SECONDS}s; retrying on next tick"
  rm -rf "$release"
  exit 0
fi

snapshot="$PRE_DEPLOY_BACKUP_DIR/job-tracker-$(date +%Y%m%d-%H%M%S)-${target_sha:0:7}.db"
as_app mkdir -p "$PRE_DEPLOY_BACKUP_DIR"
as_app sqlite3 "$db_path" ".backup '$snapshot'" || fail "pre-deploy backup"
as_app gzip -9 "$snapshot"
ls -1t "$PRE_DEPLOY_BACKUP_DIR"/*.db.gz | tail -n +$(( KEEP_PRE_DEPLOY_BACKUPS + 1 )) | xargs -r rm -f
in_release npx drizzle-kit migrate || fail "migrations (pre-deploy backup in $PRE_DEPLOY_BACKUP_DIR)"

previous=""
if [[ -L "$CURRENT_LINK" ]]; then
  previous="$(readlink -f "$CURRENT_LINK")"
fi

switch_to "$release"
# A failed restart is handled by the health check below (rollback), so it must not abort the script.
systemctl restart "$SERVICE" || log "restart of $SERVICE returned an error"

if ! wait_healthy; then
  log "health check failed for ${target_sha:0:7}"
  echo "$target_sha" > "$FAILED_MARKER"
  if [[ -n "$previous" && -d "$previous" ]]; then
    log "rolling back to $previous"
    switch_to "$previous"
    systemctl restart "$SERVICE" || log "restart after rollback returned an error"
    rm -rf "$release"
  fi
  exit 1
fi

rm -f "$FAILED_MARKER"
log "active: ${target_sha:0:7}"

# Keep the newest releases for manual rollback; never delete the active one.
active="$(readlink -f "$CURRENT_LINK")"
ls -1dt "$RELEASES_DIR"/*/ | tail -n +$(( KEEP_RELEASES + 1 )) | while read -r dir; do
  dir="${dir%/}"
  if [[ "$(readlink -f "$dir")" != "$active" ]]; then
    rm -rf "$dir"
  fi
done
