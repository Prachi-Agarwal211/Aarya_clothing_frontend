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
