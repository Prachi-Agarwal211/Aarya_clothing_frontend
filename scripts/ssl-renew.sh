#!/bin/bash
# SSL Certificate Auto-Renewal Script for Aarya Clothing
# Runs daily via cron. Attempts renewal, copies certs, and reloads nginx.
# Usage: /opt/Aarya_clothing_frontend/scripts/ssl-renew.sh
# Cron: 0 2 * * * /opt/Aarya_clothing_frontend/scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1

set -euo pipefail

PROJECT_DIR="/opt/Aarya_clothing_frontend"
DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
EMAIL="noreply@aaryaclothing.in"
CERTBOT_ARCHIVE_DIR="${PROJECT_DIR}/docker/certbot/conf/archive/${DOMAIN}"
NGINX_SSL_DIR="${PROJECT_DIR}/docker/nginx/ssl"
LOCKFILE="/tmp/ssl-renew.lock"

cd "$PROJECT_DIR"

# Prevent overlapping runs (certbot renewal can be slow)
exec 200>"$LOCKFILE"
if ! flock -n 200; then
  echo "[$(date)] ERROR: Another ssl-renew.sh is already running. Exiting."
  exit 0
fi

echo "[$(date)] Starting SSL certificate renewal check..."

# 'certbot renew' only renews certs within 30 days of expiry
docker compose run --rm certbot renew \
  --non-interactive \
  2>&1 || {
  EXIT_CODE=$?
  echo "[$(date)] WARNING: certbot renew exited with code ${EXIT_CODE} (may be normal if no renewal needed)"
}

# Find the latest cert files in the archive directory
# After renewal, certbot creates new numbered files (cert2.pem, cert3.pem, etc.)
LATEST_FULLCHAIN=$(ls -t "${CERTBOT_ARCHIVE_DIR}"/fullchain*.pem 2>/dev/null | head -1 || true)
LATEST_PRIVKEY=$(ls -t "${CERTBOT_ARCHIVE_DIR}"/privkey*.pem 2>/dev/null | head -1 || true)

if [ -z "$LATEST_FULLCHAIN" ] || [ -z "$LATEST_PRIVKEY" ]; then
  echo "[$(date)] ERROR: Could not find cert files in ${CERTBOT_ARCHIVE_DIR}"
  exit 1
fi

echo "[$(date)] Using: $LATEST_FULLCHAIN"
echo "[$(date)] Using: $LATEST_PRIVKEY"

# Copy renewed certs to nginx ssl dir
cp -f "$LATEST_FULLCHAIN" "${NGINX_SSL_DIR}/fullchain.pem"
cp -f "$LATEST_PRIVKEY" "${NGINX_SSL_DIR}/privkey.pem"
echo "[$(date)] Certs copied successfully."

# Verify the new cert expiry
NEW_EXPIRY=$(openssl x509 -in "${NGINX_SSL_DIR}/fullchain.pem" -noout -enddate 2>/dev/null || echo "unknown")
echo "[$(date)] New cert expiry: ${NEW_EXPIRY}"

# Reload nginx to pick up new certificates
echo "[$(date)] Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "[$(date)] SSL renewal check complete."
