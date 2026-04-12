#!/bin/bash
# SSL Certificate Auto-Renewal Script for Aarya Clothing
# Runs daily via cron. Attempts renewal and reloads nginx on success.
# Usage: /opt/Aarya_clothing_frontend/scripts/ssl-renew.sh
# Cron: 0 2 * * * /opt/Aarya_clothing_frontend/scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1

set -euo pipefail

PROJECT_DIR="/opt/Aarya_clothing_frontend"
DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
EMAIL="noreply@aaryaclothing.in"
WEBROOT="/var/www/certbot"

cd "$PROJECT_DIR"

echo "[$(date)] Starting SSL certificate renewal check..."

# Attempt renewal (only renews if <30 days from expiry)
docker-compose run --rm certbot \
  certonly \
  --webroot \
  -w "$WEBROOT" \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --keep-until-expiring

# Reload nginx to pick up new certificates
echo "[$(date)] Reloading nginx..."
docker-compose exec nginx nginx -s reload

echo "[$(date)] SSL renewal check complete."
