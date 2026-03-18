#!/bin/bash

# ============================================================
# SSL Certificate Setup Script for Aarya Clothing
# Using Let's Encrypt (Free SSL Certificates)
# ============================================================

set -e  # Exit on error

# Configuration
DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
EMAIL="admin@aaryaclothing.in"  # Change this to your email
CERTBOT_DIR="/var/www/certbot"
SSL_DIR="/etc/nginx/ssl"

echo "🔒 Starting SSL Certificate Setup for $DOMAIN"
echo "================================================"

# Step 1: Install Certbot if not installed
echo ""
echo "📦 Step 1: Checking Certbot installation..."
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi

# Step 2: Create necessary directories
echo ""
echo "📁 Step 2: Creating directories..."
mkdir -p $CERTBOT_DIR
mkdir -p $SSL_DIR
mkdir -p ./docker/nginx/ssl
echo "✅ Directories created"

# Step 3: Stop Nginx temporarily (to free port 80)
echo ""
echo "🛑 Step 3: Stopping Nginx temporarily..."
docker-compose stop nginx
echo "✅ Nginx stopped"

# Step 4: Get SSL certificate using standalone mode
echo ""
echo "📜 Step 4: Obtaining SSL certificate from Let's Encrypt..."

# Try to get certificate for both domain and www subdomain
certbot certonly --standalone \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d $DOMAIN \
    -d $WWW_DOMAIN \
    --preferred-challenges http \
    --http-01-port 80

echo "✅ SSL certificate obtained successfully!"

# Step 5: Copy certificates to nginx volume
echo ""
echo "📋 Step 5: Copying certificates to nginx volume..."

# For Let's Encrypt, certificates are in /etc/letsencrypt/live/
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./docker/nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./docker/nginx/ssl/privkey.pem

# Also copy to Docker volume mount point
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/fullchain.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/privkey.pem

echo "✅ Certificates copied"

# Step 6: Set proper permissions
echo ""
echo "🔐 Step 6: Setting permissions..."
chmod 644 ./docker/nginx/ssl/fullchain.pem
chmod 600 ./docker/nginx/ssl/privkey.pem
echo "✅ Permissions set"

# Step 7: Create certificate renewal script
echo ""
echo "📝 Step 7: Creating renewal script..."
cat > ./renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL Certificate Renewal Script

DOMAIN="aaryaclothing.in"
WWW_DOMAIN="www.aaryaclothing.in"
SSL_DIR="./docker/nginx/ssl"

echo "🔄 Renewing SSL certificate..."

# Stop nginx to free port 80
docker-compose stop nginx

# Renew certificate
certbot renew --standalone --http-01-port 80

# Copy renewed certificates
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/fullchain.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/privkey.pem

# Restart nginx
docker-compose start nginx

echo "✅ SSL certificate renewed successfully!"
EOF

chmod +x ./renew-ssl.sh
echo "✅ Renewal script created: ./renew-ssl.sh"

# Step 8: Add cron job for automatic renewal
echo ""
echo "⏰ Step 8: Setting up automatic renewal..."

# Create cron job (runs daily at 2 AM)
CRON_JOB="0 2 * * * cd /opt/Aarya_clothing_frontend && ./renew-ssl.sh >> /var/log/ssl-renewal.log 2>&1"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Automatic renewal cron job added"
else
    echo "✅ Automatic renewal already configured"
fi

# Step 9: Restart all services
echo ""
echo "🚀 Step 9: Restarting all services..."
docker-compose restart
echo "✅ All services restarted"

# Step 10: Verify SSL
echo ""
echo "🔍 Step 10: Verifying SSL certificate..."
echo ""
echo "Certificate details:"
openssl x509 -in ./docker/nginx/ssl/fullchain.pem -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After :)"

echo ""
echo "================================================"
echo "🎉 SSL Certificate Setup Complete!"
echo ""
echo "Domain: $DOMAIN"
echo "WWW Domain: $WWW_DOMAIN"
echo "Certificate expires in 90 days (auto-renewal configured)"
echo ""
echo "Next steps:"
echo "1. Visit https://$DOMAIN to verify SSL is working"
echo "2. Check SSL Labs rating: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo "3. Monitor renewal logs: tail -f /var/log/ssl-renewal.log"
echo ""
echo "Manual renewal command: ./renew-ssl.sh"
echo "================================================"
