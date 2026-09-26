#!/usr/bin/env bash
# Installs or updates the auto-deploy + daily backup on the server (idempotent).
# Run as root from a checkout of this repo:  sudo bash deploy/install.sh
# Re-run it whenever deploy.sh or the systemd units change.
set -euo pipefail

APP_USER="jobtracker"
BASE_DIR="/srv/job-tracker"
BACKUP_DIR="/var/lib/job-tracker/backups"
UNIT_DIR="/etc/systemd/system"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

install -d -o "$APP_USER" -g "$APP_USER" "$BASE_DIR" "$BASE_DIR/releases"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$BACKUP_DIR"

if [[ ! -d "$BASE_DIR/repo/.git" ]]; then
  repo_url="$(runuser -u "$APP_USER" -- git -C "$SRC_DIR/.." remote get-url origin)"
  runuser -u "$APP_USER" -- git clone --quiet "$repo_url" "$BASE_DIR/repo"
  echo "✓ cloned $repo_url into $BASE_DIR/repo"
fi

install -m 755 -o root -g root "$SRC_DIR/deploy.sh" /usr/local/sbin/job-tracker-deploy

for unit in "$SRC_DIR"/systemd/*.service "$SRC_DIR"/systemd/*.timer; do
  target="$UNIT_DIR/$(basename "$unit")"
  if [[ -f "$target" ]] && ! cmp -s "$unit" "$target"; then
    cp "$target" "$target.bak-$(date +%Y%m%d%H%M%S)"
  fi
  install -m 644 -o root -g root "$unit" "$target"
done
systemctl daemon-reload
echo "✓ deploy script and systemd units installed"

if [[ -L "$BASE_DIR/current" ]]; then
  systemctl enable --now job-tracker-deploy.timer job-tracker-backup.timer
  echo "✓ timers enabled (auto-deploy every 5 min, backup daily at 03:00)"
else
  echo "→ first deploy pending: run 'sudo /usr/local/sbin/job-tracker-deploy', then re-run this script to enable the timers"
fi
