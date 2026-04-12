#!/usr/bin/env bash
# Aarya Clothing VPS Monitor — run via cron every 5 minutes
# Sends email alert when thresholds are exceeded.
set -euo pipefail

ALERT=false
MSG=""
THRESHOLD=85

# Disk
DISK_USAGE=$(df -h / | awk 'NR==2{gsub(/%/,"",$5); print $5}')
if [ "$DISK_USAGE" -gt "$THRESHOLD" ]; then
    ALERT=true
    MSG="${MSG}⚠️ Disk: ${DISK_USAGE}% used\n"
fi

# Memory
MEM_USAGE=$(free | awk '/Mem:/{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt "$THRESHOLD" ]; then
    ALERT=true
    MSG="${MSG}⚠️ Memory: ${MEM_USAGE}% used\n"
fi

# Swap
SWAP_USAGE=$(free | awk '/Swap:/{if($2>0) printf "%.0f", $3/$2 * 100; else print 0}')
if [ "$SWAP_USAGE" -gt "$THRESHOLD" ]; then
    ALERT=true
    MSG="${MSG}⚠️ Swap: ${SWAP_USAGE}% used\n"
fi

# Container health
CONTAINERS_DOWN=$(docker ps --filter "status=exited" --format '{{.Names}}' 2>/dev/null | wc -l)
if [ "$CONTAINERS_DOWN" -gt 0 ]; then
    ALERT=true
    NAMES=$(docker ps --filter "status=exited" --format '{{.Names}}' 2>/dev/null | tr '\n' ', ')
    MSG="${MSG}🔴 ${CONTAINERS_DOWN} container(s) stopped: ${NAMES}\n"
fi

CONTAINERS_RESTARTING=$(docker ps --filter "restarting" --format '{{.Names}}' 2>/dev/null | wc -l)
if [ "$CONTAINERS_RESTARTING" -gt 0 ]; then
    ALERT=true
    MSG="${MSG}🟡 ${CONTAINERS_RESTARTING} container(s) restarting\n"
fi

# Load average
LOAD_1M=$(cat /proc/loadavg | awk '{print $1}')
LOAD_THRESH=3.5
if [ "$(echo "$LOAD_1M > $LOAD_THRESH" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    ALERT=true
    MSG="${MSG}⚠️ Load average: ${LOAD_1M}\n"
fi

if [ "$ALERT" = true ]; then
    MSG="${MSG}\n--- System Info ---\n"
    MSG="${MSG}Uptime: $(uptime -p 2>/dev/null || uptime)\n"
    MSG="${MSG}Docker images: $(docker images -q 2>/dev/null | wc -l) ($(docker system df --format '{{.Size}}' 2>/dev/null | head -1))\n"
    MSG="${MSG}Postgres: $(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c 'SELECT pg_size_pretty(pg_database_size(current_database()));' 2>/dev/null | xargs)\n"
    
    # Send alert via email (if mail command available)
    if command -v mail &>/dev/null; then
        echo -e "$MSG" | mail -s "⚠️ Aarya Clothing VPS Alert — $(date)" root
    fi
    
    # Also log
    echo "[$(date -u)] ALERT: $(echo -e "$MSG" | tr '\n' ';')" >> /var/log/aarya-monitor.log
fi
