#!/usr/bin/env bash
# pull-vps-backup.sh
# Fetch a PostgreSQL backup .sql.gz from the Aarya Clothing VPS host to local backups/postgres/
#
# Usage:
#   bash scripts/pull-vps-backup.sh
#   bash scripts/pull-vps-backup.sh aarya_clothing_20260605_182955.sql.gz
#   SSH_USER=ubuntu SSH_KEY=~/.ssh/my_vps_key bash scripts/pull-vps-backup.sh latest
#
# Env overrides:
#   SSH_USER   (default: root)
#   SSH_HOST   (default: 72.61.255.8)
#   SSH_KEY    (optional path to private key for -i)
#   BACKUP_DIR (default: /opt/Aarya_clothing_frontend/backups/postgres on remote)
#   LOCAL_DIR  (default: ./backups/postgres relative to this script's project)
#
# The script is idempotent-ish and verifies the remote file exists before scp.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults (discovered 2026-06-05)
SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-72.61.255.8}"
REMOTE_BACKUP_DIR="${BACKUP_DIR:-/opt/Aarya_clothing_frontend/backups/postgres}"
LOCAL_DIR="${LOCAL_DIR:-$PROJECT_ROOT/backups/postgres}"

# Filename: arg1 or the specific one requested by user on 2026-06-05
FILENAME="${1:-aarya_clothing_20260605_182955.sql.gz}"

if [[ "$FILENAME" == "latest" ]]; then
    echo "Resolving latest backup on VPS..."
    # Ask remote for the most recent matching file
    LATEST_CMD="ls -1t ${REMOTE_BACKUP_DIR}/aarya_clothing_*.sql.gz 2>/dev/null | head -1 | xargs -r basename"
    if [[ -n "${SSH_KEY:-}" ]]; then
        LATEST_FILE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" "$LATEST_CMD")
    else
        LATEST_FILE=$(ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}" "$LATEST_CMD")
    fi
    if [[ -z "$LATEST_FILE" ]]; then
        echo "ERROR: Could not determine latest backup on remote."
        exit 1
    fi
    FILENAME="$LATEST_FILE"
    echo "Latest: $FILENAME"
fi

REMOTE_FILE="${REMOTE_BACKUP_DIR}/${FILENAME}"
LOCAL_FILE="${LOCAL_DIR}/${FILENAME}"

echo "=== Aarya VPS Backup Pull ==="
echo "Remote: ${SSH_USER}@${SSH_HOST}:${REMOTE_FILE}"
echo "Local : ${LOCAL_FILE}"
echo ""

# Ensure local target dir exists
mkdir -p "$LOCAL_DIR"

# Build ssh/scp options
SSH_OPTS=("-o" "StrictHostKeyChecking=accept-new" "-o" "ConnectTimeout=15")
SCP_OPTS=("${SSH_OPTS[@]}")
if [[ -n "${SSH_KEY:-}" ]]; then
    SSH_OPTS+=("-i" "$SSH_KEY")
    SCP_OPTS+=("-i" "$SSH_KEY")
fi

# 1. Verify remote file exists and get size
echo "[1/3] Checking remote file..."
if [[ -n "${SSH_KEY:-}" ]]; then
    REMOTE_INFO=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "ls -lh '$REMOTE_FILE' 2>/dev/null || echo 'MISSING'" )
else
    REMOTE_INFO=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "ls -lh '$REMOTE_FILE' 2>/dev/null || echo 'MISSING'" )
fi

if echo "$REMOTE_INFO" | grep -q 'MISSING'; then
    echo "ERROR: Remote file not found: $REMOTE_FILE"
    echo "Available recent backups on VPS:"
    if [[ -n "${SSH_KEY:-}" ]]; then
        ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "ls -1t ${REMOTE_BACKUP_DIR}/aarya_clothing_*.sql.gz 2>/dev/null | head -8"
    else
        ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "ls -1t ${REMOTE_BACKUP_DIR}/aarya_clothing_*.sql.gz 2>/dev/null | head -8"
    fi
    exit 1
fi

echo "Remote: $REMOTE_INFO"

# 2. scp it down (resume not supported by basic scp; use rsync if available for big files)
echo "[2/3] Transferring (scp)..."
if [[ -n "${SSH_KEY:-}" ]]; then
    scp "${SCP_OPTS[@]}" "${SSH_USER}@${SSH_HOST}:${REMOTE_FILE}" "$LOCAL_FILE"
else
    scp "${SCP_OPTS[@]}" "${SSH_USER}@${SSH_HOST}:${REMOTE_FILE}" "$LOCAL_FILE"
fi

# 3. Verify local + show info
echo "[3/3] Verifying local copy..."
if [[ ! -f "$LOCAL_FILE" ]]; then
    echo "ERROR: scp reported success but local file missing."
    exit 1
fi

LOCAL_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
LOCAL_LS=$(ls -lh "$LOCAL_FILE")

echo "SUCCESS: Downloaded to $LOCAL_FILE"
echo "Size: $LOCAL_SIZE"
echo "$LOCAL_LS"
echo ""

echo "Recent local backups now:"
ls -1t "$LOCAL_DIR"/aarya_clothing_*.sql.gz 2>/dev/null | head -6 || ls -1t "$LOCAL_DIR"/*.sql.gz 2>/dev/null | head -6

echo ""
echo "Tip: To load into local dev DB (docker):"
echo "  gunzip -c '$LOCAL_FILE' | docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T postgres psql -U postgres -d aarya_clothing"
echo "  (or use --clean etc; test on a throwaway DB first)"

echo "=== Done ==="
