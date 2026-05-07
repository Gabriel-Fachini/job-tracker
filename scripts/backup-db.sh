#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="$PROJECT_ROOT/backups"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

TIMESTAMP=$(date '+%Y-%m-%d')
WEEK=$(date '+%Y-W%V')
MONTH=$(date '+%Y-%m')
DOW=$(date '+%u')
DOM=$(date '+%d')

log_message() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_message "Backup started"

# Online backup via sqlite3 API
TEMP_DB="/tmp/job-tracker-snap.db"
if ! sqlite3 "$PROJECT_ROOT/job-tracker.db" ".backup $TEMP_DB" 2>&1 | tee -a "$LOG_FILE"; then
  log_message "ERROR: sqlite3 backup failed"
  exit 1
fi

# Compress
if ! gzip -9 "$TEMP_DB"; then
  log_message "ERROR: gzip failed"
  exit 1
fi

COMPRESSED="$TEMP_DB.gz"

# Daily backup
DAILY_FILE="$DAILY_DIR/job-tracker-$TIMESTAMP.db.gz"
mv "$COMPRESSED" "$DAILY_FILE"
log_message "Daily backup saved: $DAILY_FILE"

# Weekly backup (Sunday = 7)
if [ "$DOW" -eq 7 ]; then
  WEEKLY_FILE="$WEEKLY_DIR/job-tracker-$WEEK.db.gz"
  cp "$DAILY_FILE" "$WEEKLY_FILE"
  log_message "Weekly backup saved: $WEEKLY_FILE"
fi

# Monthly backup (first Sunday = DOM 1-7 AND DOW 7)
if [ "$DOM" -le 7 ] && [ "$DOW" -eq 7 ]; then
  MONTHLY_FILE="$MONTHLY_DIR/job-tracker-$MONTH.db.gz"
  cp "$DAILY_FILE" "$MONTHLY_FILE"
  log_message "Monthly backup saved: $MONTHLY_FILE"
fi

# Rotation
find "$DAILY_DIR" -mtime +7 -delete
find "$WEEKLY_DIR" -mtime +28 -delete
find "$MONTHLY_DIR" -mtime +93 -delete

log_message "Backup completed successfully"
