#!/bin/bash
# PostgreSQL Backup Script for Aarya Clothing
# Usage: bash /opt/Aarya_clothing_frontend/scripts/backup-db.sh

set -euo pipefail

BACKUP_DIR="/opt/Aarya_clothing_frontend/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aarya_clothing_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "=== PostgreSQL Backup Starting ==="
echo "File: $BACKUP_FILE"
echo ""

docker exec aarya_postgres pg_dump -U postgres -d aarya_clothing --clean --if-exists | gzip > "$BACKUP_FILE"

echo "=== Backup Complete ==="
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm

echo "=== Recent Backups ==="
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5
