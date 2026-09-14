#!/usr/bin/env bash
# Applies a SQL file to your Supabase database via the connection pooler.
# Usage:
#   ./scripts/migrate-supabase.sh "postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" [file.sql]
# (defaults to supabase/schema.sql — the full app migration)
set -e
URI="$1"; FILE="${2:-supabase/schema.sql}"
if [ -z "$URI" ] || [ -z "$FILE" ]; then
  echo 'usage: ./scripts/migrate-supabase.sh "postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" [file.sql]'
  exit 1
fi
PSQL="$(pg_config --bindir 2>/dev/null)/psql"
[ -x "$PSQL" ] || PSQL="psql"

# Session pooler (5432) is preferred for migrations; fall back to transaction mode (6543).
if "$PSQL" "$URI" -c 'select 1' >/dev/null 2>&1; then
  "$PSQL" "$URI" -v ON_ERROR_STOP=1 -f "$FILE"
else
  echo "(5432 refused — retrying on 6543…)"
  FALLBACK="${URI/:5432//:6543}"
  "$PSQL" "$FALLBACK" -v ON_ERROR_STOP=1 -f "$FILE"
fi
echo "✓ applied $FILE"
