#!/bin/bash
# Database Backup Script - Created before OTP-only changes
# Date: 2026-04-17 15:50:50
# Purpose: Backup PostgreSQL database before making breaking changes to verification system

set -e

echo "=== Starting Database Backup ==="
echo "Timestamp: $(date)"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "ERROR: docker-compose not found. Cannot create backup."
    exit 1
fi

BACKUP_DIR="./database_backups"
BACKUP_FILE="${BACKUP_DIR}/aarya_clothing_backup_$(date +%Y%m%d_%H%M%S).sql"
LOG_FILE="${BACKUP_DIR}/backup_log_$(date +%Y%m%d_%H%M%S).txt"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup database using docker-compose exec
echo "Backing up PostgreSQL database to ${BACKUP_FILE}..."
echo "Backup started at: $(date)" > "${LOG_FILE}"

if docker-compose exec postgres pg_dump -U aarya -F c -b -v -f /backups/aarya_clothing_backup_$(date +%Y%m%d_%H%M%S).dump db_aarya_clothing 2>> "${LOG_FILE}"; then
    echo "Database dump created in container: /backups/aarya_clothing_backup_$(date +%Y%m%d_%H%M%S).dump"
    
    # Copy backup from container to host
    docker-compose cp postgres:/backups/aarya_clothing_backup_$(date +%Y%m%d_%H%M%S).dump "${BACKUP_FILE}"
    
    if [ -f "${BACKUP_FILE}" ]; then
        echo "Backup file size: $(du -h "${BACKUP_FILE}" | cut -f1)"
        echo "✓ Database backup created successfully: ${BACKUP_FILE}"
    else
        echo "ERROR: Failed to copy backup file from container"
        exit 1
    fi
else
    echo "ERROR: Failed to create database dump"
    exit 1
fi

echo "Backup completed at: $(date)" >> "${LOG_FILE}"
echo "=== Database Backup Complete ==="

# Also create a plain SQL backup for easier inspection
PLAIN_BACKUP="${BACKUP_DIR}/aarya_clothing_plain_$(date +%Y%m%d_%H%M%S).sql"
echo "Creating plain SQL backup at ${PLAIN_BACKUP}..."
docker-compose exec postgres pg_dump -U aarya db_aarya_clothing > "${PLAIN_BACKUP}" 2>> "${LOG_FILE}"

if [ -f "${PLAIN_BACKUP}" ]; then
    echo "✓ Plain SQL backup created: ${PLAIN_BACKUP}"
    echo "Plain backup file size: $(du -h "${PLAIN_BACKUP}" | cut -f1)"
else
    echo "WARNING: Plain SQL backup may have failed"
fi

echo ""
echo "=== Backup Summary ==="
echo "Backup: ${BACKUP_FILE}"
echo "Plain SQL: ${PLAIN_BACKUP}"
echo "Log: ${LOG_FILE}"
echo ""
echo "To restore from backup, run:"
echo "  cat ${PLAIN_BACKUP} | docker-compose exec -T postgres psql -U aarya db_aarya_clothing"
echo ""
echo "Or use docker-compose cp and pg_restore for the .dump file"
