#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.db.gz>"
  echo "Example: $0 backups/daily/job-tracker-2026-05-07.db.gz"
  exit 1
fi

BACKUP_FILE="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# DATABASE_URL lets the server reuse this script; without it the local project DB is restored.
DB_PATH="${DATABASE_URL:-$PROJECT_ROOT/job-tracker.db}"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
SAFETY_COPY="$DB_PATH.pre-restore-$TIMESTAMP"

echo "⚠️  WARNING: This will restore database from: $BACKUP_FILE"
echo "Current database will be backed up to: $SAFETY_COPY"
echo "Make sure to STOP the app ('npm run dev' or 'systemctl stop job-tracker') before proceeding"
echo ""
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Restore cancelled"
  exit 0
fi

# Safety copy of current DB (WAL/SHM moved aside so a stale WAL is not replayed onto the restored file)
if [ -f "$DB_PATH" ]; then
  cp "$DB_PATH" "$SAFETY_COPY"
  echo "✓ Safety copy created: $SAFETY_COPY"
fi
for suffix in wal shm; do
  if [ -f "$DB_PATH-$suffix" ]; then
    mv "$DB_PATH-$suffix" "$SAFETY_COPY-$suffix"
  fi
done

# Restore
gunzip -c "$BACKUP_FILE" > "$DB_PATH"
echo "✓ Database restored from $BACKUP_FILE"
echo "✓ Current database backed up to: $SAFETY_COPY"
echo ""
echo "Next steps:"
echo "1. Restart the app ('npm run dev' or 'systemctl start job-tracker')"
echo "2. If issues: restore safety copy with: cp $SAFETY_COPY $DB_PATH"
