#!/usr/bin/env bash
# Add swap file as OOM safety net for the VPS.
# Run once on the VPS host (requires root).
set -euo pipefail

SWAP_SIZE="${1:-4G}"
SWAPFILE="/swapfile"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (sudo)"
  exit 1
fi

if [ -f "$SWAPFILE" ]; then
  echo "Swap file already exists at $SWAPFILE — skipping creation."
else
  echo "Creating ${SWAP_SIZE} swap file at $SWAPFILE ..."
  fallocate -l "$SWAP_SIZE" "$SWAPFILE"
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE"
  swapon "$SWAPFILE"

  # Make persistent across reboots
  if ! grep -q "$SWAPFILE" /etc/fstab; then
    echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
    echo "Added to /etc/fstab for persistence."
  fi
fi

# Tune swappiness to 10 — only use swap when RAM is nearly full
sysctl -w vm.swappiness=10 2>/dev/null || true
if ! grep -q "vm.swappiness=10" /etc/sysctl.conf 2>/dev/null; then
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "Set vm.swappiness=10 for persistence."
fi

echo "=== Swap status ==="
swapon --show
free -h
echo "Swappiness: $(cat /proc/sys/vm/swappiness)"
