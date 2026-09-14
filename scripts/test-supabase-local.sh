#!/usr/bin/env bash
# Validates supabase/schema.sql against a real local PostgreSQL with
# Supabase platform stubs (auth.uid, storage, realtime publication).
# No Supabase account needed. Requires: postgres (initdb/psql in PATH or PG_BIN set).
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || dirname "$(command -v psql)")}"
PGDATA="${PGDATA:-/tmp/ta-pgdata}"
PGPORT="${PGPORT:-55432}"

if [ ! -d "$PGDATA" ]; then
  echo "· initializing test cluster at $PGDATA"
  "$PG_BIN/initdb" -D "$PGDATA" -U postgres >/dev/null
fi

echo "· starting postgres on :$PGPORT"
"$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l /tmp/ta-pg.log start >/dev/null
trap '"$PG_BIN/pg_ctl" -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true' EXIT

URL="postgres://postgres@127.0.0.1:$PGPORT"
psql "$URL/postgres" -qc 'drop database if exists ta_test;' >/dev/null
psql "$URL/postgres" -qc 'create database ta_test;' >/dev/null

echo "· applying supabase platform stubs"
psql "$URL/ta_test" -v ON_ERROR_STOP=1 -q -f test/supabase-stubs.sql

echo "· applying supabase/schema.sql"
psql "$URL/ta_test" -v ON_ERROR_STOP=1 -f supabase/schema.sql

echo "· applying role grants"
psql "$URL/ta_test" -v ON_ERROR_STOP=1 -q -f test/supabase-grants.sql

echo "· running behavioral tests"
psql "$URL/ta_test" -v ON_ERROR_STOP=1 -f test/supabase-test.sql
