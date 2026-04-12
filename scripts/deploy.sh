#!/usr/bin/env bash
# Aarya Clothing — Zero-Downtime Deployment Script
# Usage: ./scripts/deploy.sh [service_name]
#   service_name: specific service to redeploy (e.g., 'commerce')
#   omit: rebuild and redeploy all services
set -euo pipefail

cd /opt/Aarya_clothing_frontend

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-flight checks
log "=== Pre-flight checks ==="
if ! docker ps > /dev/null 2>&1; then
    err "Docker is not running"
    exit 1
fi

if ! docker compose config > /dev/null 2>&1; then
    err "docker-compose.yml is invalid"
    exit 1
fi

log "Docker: OK"
log "Compose config: OK"

# Git status
if git diff --quiet HEAD 2>/dev/null; then
    log "Working tree clean"
else
    warn "Working tree has uncommitted changes — proceeding anyway"
fi

# Prune dangling images before build (reclaim disk space)
log "=== Pruning dangling images ==="
BEFORE=$(docker system df --format '{{.Reclaimable}}' 2>/dev/null | head -1 || echo "unknown")
docker image prune -f 2>/dev/null || true
log "Pruned: $BEFORE reclaimable"

# Build and deploy
if [ $# -ge 1 ]; then
    SERVICE="$1"
    log "=== Rebuilding service: $SERVICE ==="
    docker compose up -d --build --no-deps "$SERVICE" 2>&1
    if [ $? -ne 0 ]; then
        err "Build failed for $SERVICE"
        exit 1
    fi
    log "Waiting for $SERVICE to become healthy..."
    sleep 5
    docker compose ps "$SERVICE" 2>/dev/null
else
    log "=== Rebuilding all services ==="
    docker compose up -d --build 2>&1
    if [ $? -ne 0 ]; then
        err "Build failed"
        exit 1
    fi
    log "Waiting for health checks..."
    sleep 10
fi

# Post-deploy verification
log "=== Post-deploy verification ==="
FAILED=0
for svc in postgres redis meilisearch core commerce payment admin frontend nginx; do
    STATUS=$(docker compose ps "$svc" --format '{{.Status}}' 2>/dev/null || echo "not found")
    if echo "$STATUS" | grep -qi "unhealthy"; then
        err "$svc: UNHEALTHY — $STATUS"
        FAILED=$((FAILED + 1))
    elif echo "$STATUS" | grep -qi "up"; then
        log "$svc: OK — $STATUS"
    else
        warn "$svc: $STATUS"
    fi
done

if [ $FAILED -gt 0 ]; then
    err "$FAILED service(s) unhealthy — check logs with: docker logs aarya_<service>"
    exit 1
fi

# Final status
log "=== Deployment complete ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
