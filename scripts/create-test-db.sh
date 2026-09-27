#!/usr/bin/env bash
# Recreates tmp/test.db with the schema only (no rows) for `npm test`.
# The schema is read from a local database (default ./job-tracker.db); its data is never copied.
set -euo pipefail

SOURCE_DB="${TEST_DB_SCHEMA_SOURCE:-./job-tracker.db}"
TARGET_DB="./tmp/test.db"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "create-test-db: sqlite3 CLI not found" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DB" ]]; then
  echo "create-test-db: schema source $SOURCE_DB not found (set TEST_DB_SCHEMA_SOURCE)" >&2
  exit 1
fi

if [[ "$(cd "$(dirname "$SOURCE_DB")" && pwd)/$(basename "$SOURCE_DB")" == "$(pwd)/tmp/test.db" ]]; then
  echo "create-test-db: schema source and target are the same file" >&2
  exit 1
fi

mkdir -p tmp
rm -f "$TARGET_DB"
# sqlite_sequence is internal and cannot be created by hand.
sqlite3 "$SOURCE_DB" .schema | sed '/sqlite_sequence/d' | sqlite3 "$TARGET_DB"

if ! sqlite3 "$TARGET_DB" "select 1 from job_leads limit 1" >/dev/null; then
  echo "create-test-db: $TARGET_DB has no job_leads table" >&2
  exit 1
fi
