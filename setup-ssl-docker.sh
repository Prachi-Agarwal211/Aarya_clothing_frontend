#!/bin/bash

# ============================================================
# SSL Certificate Setup - Docker-only Method
# No host installation required
# ============================================================

set -e

DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
EMAIL="admin@aaryaclothing.in"  # CHANGE THIS TO YOUR EMAIL

echo "🔒 SSL Setup for Aarya Clothing (Docker Method)"
echo "================================================"
echo ""
echo "Domain: $DOMAIN"
echo "WWW Domain: $WWW_DOMAIN"
echo "Email: $EMAIL"
echo ""

# Step 1: Create SSL directory
echo ""
echo "📁 Creating SSL directory..."
mkdir -p ./docker/nginx/ssl
mkdir -p ./docker/certbot/conf
mkdir -p ./docker/certbot/www

# Step 2: Create dummy certificates (to allow nginx to start)
echo "📜 Creating temporary certificates..."
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout ./docker/nginx/ssl/privkey.pem \
    -out ./docker/nginx/ssl/fullchain.pem \
    -subj "/CN=temporary" \
    2>/dev/null

echo "✅ Temporary certificates created"

# Step 3: Stop nginx to free port 80
echo ""
echo "🛑 Stopping nginx to free port 80..."
docker-compose stop nginx
sleep 2

# Step 4: Start standalone certbot (not webroot)
echo ""
echo "🔐 Obtaining SSL certificate from Let's Encrypt..."

docker run --rm \
    -v ./docker/certbot/conf:/etc/letsencrypt \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d $DOMAIN \
    -d $WWW_DOMAIN \
    --preferred-challenges http \
    --http-01-port 80

# Step 5: Copy certificates to correct location
echo ""
echo "📋 Copying certificates..."

# Certbot creates certs in conf/live/domain/
# We need to copy them to nginx/ssl/
cp ./docker/certbot/conf/live/$DOMAIN/fullchain.pem ./docker/nginx/ssl/fullchain.pem
cp ./docker/certbot/conf/live/$DOMAIN/privkey.pem ./docker/nginx/ssl/privkey.pem
cp ./docker/certbot/conf/live/$DOMAIN/chain.pem ./docker/nginx/ssl/chain.pem

# Set permissions
chmod 644 ./docker/nginx/ssl/fullchain.pem
chmod 644 ./docker/nginx/ssl/chain.pem
chmod 600 ./docker/nginx/ssl/privkey.pem

echo "✅ Certificates copied and permissions set"

# Step 6: Create renewal script
echo ""
echo "📝 Creating renewal script..."

cat > ./renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
EMAIL="admin@aaryaclothing.in"

echo "🔄 Renewing SSL certificate..."

# Stop nginx to free port 80
docker-compose stop nginx
sleep 2

docker run --rm \
    -v ./docker/certbot/conf:/etc/letsencrypt \
    -p 80:80 \
    certbot/certbot renew \
    --standalone \
    --http-01-port 80

# Copy renewed certificates
cp ./docker/certbot/conf/live/$DOMAIN/fullchain.pem ./docker/nginx/ssl/fullchain.pem
cp ./docker/certbot/conf/live/$DOMAIN/privkey.pem ./docker/nginx/ssl/privkey.pem
cp ./docker/certbot/conf/live/$DOMAIN/chain.pem ./docker/nginx/ssl/chain.pem

# Restart nginx
docker-compose start nginx

echo "✅ SSL certificate renewed!"
echo "New expiry: $(openssl x509 -enddate -noout -in ./docker/nginx/ssl/fullchain.pem)"
EOF

chmod +x ./renew-ssl.sh

echo "✅ Renewal script created: ./renew-ssl.sh"

# Step 7: Setup automatic renewal (cron)
echo ""
echo "⏰ Setting up automatic renewal..."

CRON_JOB="0 2 * * * cd /opt/Aarya_clothing_frontend && ./renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1"

if ! crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added (runs daily at 2 AM)"
else
    echo "✅ Automatic renewal already configured"
fi

# Step 8: Force recreate nginx to pick up new certificates
echo ""
echo "🚀 Restarting nginx with new SSL certificates..."
docker-compose up -d --force-recreate nginx
sleep 3

echo ""
echo "================================================"
echo "🎉 SSL Certificate Setup Complete!"
echo ""
echo "✅ Certificate obtained for:"
echo "   - $DOMAIN"
echo "   - $WWW_DOMAIN"
echo ""
echo "✅ Certificate location: ./docker/nginx/ssl/"
echo "✅ Auto-renewal: Configured (daily at 2 AM)"
echo ""
echo "📊 Next Steps:"
echo "   1. Visit: https://$DOMAIN"
echo "   2. Test SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "   3. Check cert: openssl x509 -in ./docker/nginx/ssl/fullchain.pem -text -noout"
echo ""
echo "🔧 Manual renewal: ./renew-ssl.sh"
echo "📋 View logs: tail -f /var/log/ssl-renewal.log"
echo "================================================"
