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

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
SAFETY_COPY="$PROJECT_ROOT/job-tracker.db.pre-restore-$TIMESTAMP"

echo "⚠️  WARNING: This will restore database from: $BACKUP_FILE"
echo "Current database will be backed up to: $SAFETY_COPY"
echo "Make sure to STOP 'npm run dev' before proceeding"
echo ""
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Restore cancelled"
  exit 0
fi

# Safety copy of current DB
if [ -f "$PROJECT_ROOT/job-tracker.db" ]; then
  cp "$PROJECT_ROOT/job-tracker.db" "$SAFETY_COPY"
  echo "✓ Safety copy created: $SAFETY_COPY"
fi

# Restore
gunzip -c "$BACKUP_FILE" > "$PROJECT_ROOT/job-tracker.db"
echo "✓ Database restored from $BACKUP_FILE"
echo "✓ Current database backed up to: $SAFETY_COPY"
echo ""
echo "Next steps:"
echo "1. Restart 'npm run dev'"
echo "2. If issues: restore safety copy with: cp $SAFETY_COPY $PROJECT_ROOT/job-tracker.db"
