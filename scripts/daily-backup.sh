#!/bin/bash
# Daily PostgreSQL Backup Script for Aarya Clothing
# Runs automatically at 2 AM via cron
# Backups stored in: /opt/Aarya_clothing_frontend/backups/postgres/

set -euo pipefail

BACKUP_DIR="/opt/Aarya_clothing_frontend/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aarya_clothing_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

docker exec aarya_postgres pg_dump -U postgres -d aarya_clothing --clean --if-exists | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup complete: $(du -h "$BACKUP_FILE" | cut -f1)"

# Keep only last 14 backups (2 weeks)
ls -t "$BACKUP_DIR"/aarya_clothing_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm
echo "[$(date)] Old backups cleaned. Remaining: $(ls "$BACKUP_DIR"/aarya_clothing_*.sql.gz 2>/dev/null | wc -l)"
