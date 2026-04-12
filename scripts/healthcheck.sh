#!/usr/bin/env bash
# Aarya Clothing — Quick stack health check
# Run on the VPS host:  bash scripts/healthcheck.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================="
echo " Aarya Clothing Health Check"
echo " $(date -u)"
echo "============================================="
echo ""

# --- Containers ---
echo "── Containers ──"
if command -v docker &>/dev/null; then
  docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || echo "docker ps failed"
  echo ""

  UNHEALTHY=$(docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null | grep -i "unhealthy" || true)
  if [ -n "$UNHEALTHY" ]; then
    echo -e "${RED}⚠ UNHEALTHY:${NC} $UNHEALTHY"
    echo ""
  fi
else
  echo -e "${RED}docker not found${NC}"
fi

# --- Load / CPU ---
echo "── System Load ──"
uptime 2>/dev/null || true
echo ""

# --- Memory ---
echo "── Memory ──"
free -h 2>/dev/null || true
echo ""

# --- Disk ---
echo "── Disk ──"
df -h / 2>/dev/null | tail -1 || true
echo ""

# --- PostgreSQL Connections ---
echo "── PostgreSQL ──"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q aarya_postgres; then
  CONN_COUNT=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='aarya_clothing';" 2>/dev/null | tr -d ' ')
  echo "Active connections: ${CONN_COUNT:-N/A}"

  CACHE_HIT=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c \
    "SELECT CASE WHEN sum(blks_hit)+sum(blks_read)>0 THEN round(sum(blks_hit)::float/(sum(blks_hit)+sum(blks_read))*100,1) ELSE 0 END FROM pg_stat_database WHERE datname='aarya_clothing';" 2>/dev/null | tr -d ' ')
  echo "Cache hit ratio: ${CACHE_HIT:-N/A}%"
else
  echo -e "${RED}Postgres not running${NC}"
fi
echo ""

# --- Redis ---
echo "── Redis ──"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q aarya_redis; then
  REDIS_MEM=$(docker exec aarya_redis redis-cli -a "${REDIS_PASSWORD:-aarya_clothing_redis_password_2024}" --no-auth-warning INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
  REDIS_HITS=$(docker exec aarya_redis redis-cli -a "${REDIS_PASSWORD:-aarya_clothing_redis_password_2024}" --no-auth-warning INFO stats 2>/dev/null | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
  REDIS_MISSES=$(docker exec aarya_redis redis-cli -a "${REDIS_PASSWORD:-aarya_clothing_redis_password_2024}" --no-auth-warning INFO stats 2>/dev/null | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
  echo "Memory: ${REDIS_MEM:-N/A}"
  echo "Hits: ${REDIS_HITS:-0} | Misses: ${REDIS_MISSES:-0}"
  if [ -n "$REDIS_HITS" ] && [ -n "$REDIS_MISSES" ] && [ "$((REDIS_HITS + REDIS_MISSES))" -gt 0 ]; then
    HIT_RATE=$((REDIS_HITS * 100 / (REDIS_HITS + REDIS_MISSES)))
    echo "Hit rate: ${HIT_RATE}%"
  fi
else
  echo -e "${RED}Redis not running${NC}"
fi
echo ""

# --- Docker Stats Snapshot ---
echo "── Resource Usage ──"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
echo ""

echo "============================================="
echo " Done"
echo "============================================="
