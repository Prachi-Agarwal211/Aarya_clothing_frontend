#!/bin/sh
# Entrypoint: auto-generate userlist.txt from environment variables.
# Uses SCRAM-SHA-256 auth (plain text passwords in userlist.txt).
# Regenerates on every start to stay in sync with POSTGRES_PASSWORD.
set -e

USERLIST="/etc/pgbouncer/userlist.txt"
DB_USER="${PGBOUNCER_DB_USER:-postgres}"
DB_PASS="${PGBOUNCER_AUTH_PASSWORD:-${POSTGRES_PASSWORD:-postgres123}}"

echo "\"${DB_USER}\" \"${DB_PASS}\"" > "$USERLIST"
echo "[entrypoint] Generated userlist.txt for user '${DB_USER}'"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
