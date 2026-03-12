# Production Deployment Scripts

## Quick Deployment Script
```bash
#!/bin/bash
# quick-deploy.sh - One-command production deployment

set -e

DOMAIN="your-domain.com"
APP_DIR="/home/aarya/aarya-clothing"

echo "🚀 Starting production deployment for $DOMAIN"

# Update domain in configs
sed -i "s/your-domain.com/$DOMAIN/g" $APP_DIR/production/nginx/nginx.prod.conf
sed -i "s/your-domain.com/$DOMAIN/g" $APP_DIR/production/.env

# Build and deploy
echo "📦 Building production images..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml build --no-cache

echo "🚀 Deploying services..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "🔍 Verifying deployment..."
if curl -f -s https://$DOMAIN/health > /dev/null; then
    echo "✅ Deployment successful!"
    echo "🌐 Your site is live at: https://$DOMAIN"
else
    echo "❌ Deployment failed - check logs"
    docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml logs --tail 50
    exit 1
fi
```

## Environment Setup Script
```bash
#!/bin/bash
# setup-environment.sh - Initialize production environment

set -e

DOMAIN="your-domain.com"
APP_DIR="/home/aarya/aarya-clothing"

echo "🔧 Setting up production environment for $DOMAIN"

# Create directories
mkdir -p $APP_DIR/production/{secrets,scripts,logs/{core,commerce,payment,admin,nginx},backups}
mkdir -p $APP_DIR/production/nginx
mkdir -p $APP_DIR/production/postgres

# Generate secure passwords
echo "🔐 Generating secure passwords..."
openssl rand -base64 32 > $APP_DIR/production/secrets/postgres_password.txt
openssl rand -base64 32 > $APP_DIR/production/secrets/meili_master_key.txt
openssl rand -base64 32 > $APP_DIR/production/secrets/jwt_secret.txt
openssl rand -base64 32 > $APP_DIR/production/secrets/redis_password.txt

# Set permissions
chmod 600 $APP_DIR/production/secrets/*

echo "✅ Environment setup complete!"
echo "⚠️  Remember to:"
echo "   1. Update $DOMAIN with your actual domain"
echo "   2. Add your API keys and secrets"
echo "   3. Configure SMTP settings"
echo "   4. Set up payment gateway credentials"
```

## SSL Setup Script
```bash
#!/bin/bash
# setup-ssl.sh - Automated SSL certificate setup

set -e

DOMAIN="your-domain.com"
EMAIL="your-email@gmail.com"

echo "🔒 Setting up SSL for $DOMAIN"

# Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Create certbot directory
sudo mkdir -p /var/www/certbot

# Obtain SSL certificate
echo "📜 Obtaining SSL certificate..."
sudo certbot certonly --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email

# Setup auto-renewal
echo "🔄 Setting up auto-renewal..."
sudo crontab -l | grep -v "certbot" | sudo crontab -
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/production/docker-compose.prod.yml restart nginx" | sudo crontab -

# Test renewal
sudo certbot renew --dry-run

echo "✅ SSL setup complete!"
echo "🔐 Certificate valid for: $(sudo certbot certificates | grep -A1 'Certificate Name:' | tail -1 | awk '{print $1, $2, $3}')"
```

## Database Initialization Script
```bash
#!/bin/bash
# init-database.sh - Initialize production database

set -e

APP_DIR="/home/aarya/aarya-clothing"

echo "🗄️ Initializing production database..."

# Start only PostgreSQL
echo "🚀 Starting PostgreSQL..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 30

# Check if PostgreSQL is ready
until docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres pg_isready -U postgres; do
    echo "Waiting for PostgreSQL..."
    sleep 5
done

# Run database initialization
echo "📝 Running database initialization..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -f /docker-entrypoint-initdb.d/init.sql

# Verify initialization
echo "🔍 Verifying database initialization..."
USER_COUNT=$(docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')

if [ "$USER_COUNT" -gt 0 ]; then
    echo "✅ Database initialized successfully!"
    echo "👥 Created $USER_COUNT users"
    
    # Show admin credentials
    echo "🔑 Admin credentials:"
    docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -c "SELECT email, 'admin123' as password FROM users WHERE role = 'admin';"
else
    echo "❌ Database initialization failed!"
    exit 1
fi
```

## Health Check Script
```bash
#!/bin/bash
# health-check.sh - Comprehensive health monitoring

DOMAIN="your-domain.com"
WEBHOOK_URL="your-monitoring-webhook-url"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏥 Performing health check for $DOMAIN"

# Check services
services=("core" "commerce" "payment" "admin" "frontend" "postgres" "redis" "meilisearch" "nginx")
all_healthy=true

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml ps $service | grep -q "Up"; then
        echo -e "${GREEN}✅ $service is healthy${NC}"
    else
        echo -e "${RED}❌ $service is down${NC}"
        all_healthy=false
        # Send alert
        curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"🚨 $service is down on production\"}" 2>/dev/null
    fi
done

# Check website accessibility
if curl -f -s https://$DOMAIN > /dev/null; then
    echo -e "${GREEN}✅ Website is accessible${NC}"
else
    echo -e "${RED}❌ Website is not accessible${NC}"
    all_healthy=false
    curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"🚨 Website https://$DOMAIN is not accessible\"}" 2>/dev/null
fi

# Check API endpoints
api_endpoints=("/health" "/api/v1/landing/all" "/admin/health")
for endpoint in "${api_endpoints[@]}"; do
    if curl -f -s https://$DOMAIN$endpoint > /dev/null; then
        echo -e "${GREEN}✅ API $endpoint responding${NC}"
    else
        echo -e "${RED}❌ API $endpoint not responding${NC}"
        all_healthy=false
    fi
done

# Check disk space
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $disk_usage -gt 80 ]; then
    echo -e "${YELLOW}⚠️ Disk usage is ${disk_usage}%${NC}"
    curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"⚠️ Disk usage is ${disk_usage}% on production\"}" 2>/dev/null
else
    echo -e "${GREEN}✅ Disk usage is ${disk_usage}%${NC}"
fi

# Check memory usage
memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $memory_usage -gt 85 ]; then
    echo -e "${YELLOW}⚠️ Memory usage is ${memory_usage}%${NC}"
    curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"⚠️ Memory usage is ${memory_usage}% on production\"}" 2>/dev/null
else
    echo -e "${GREEN}✅ Memory usage is ${memory_usage}%${NC}"
fi

# Overall status
if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}🎉 All systems healthy!${NC}"
    exit 0
else
    echo -e "${RED}🚨 Some systems need attention!${NC}"
    exit 1
fi
```

## Backup Script
```bash
#!/bin/bash
# backup.sh - Automated backup system

APP_DIR="/home/aarya/aarya-clothing"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "🗄️ Backing up database..."
DB_BACKUP_FILE="aarya_clothing_db_backup_$DATE.sql"
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres pg_dump -U postgres aarya_clothing_prod > $BACKUP_DIR/$DB_BACKUP_FILE

# Compress database backup
gzip $BACKUP_DIR/$DB_BACKUP_FILE
echo "✅ Database backup: $DB_BACKUP_FILE.gz"

# Files backup
echo "📁 Backing up important files..."
FILES_BACKUP_FILE="aarya_clothing_files_backup_$DATE.tar.gz"
tar -czf $BACKUP_DIR/$FILES_BACKUP_FILE \
    $APP_DIR/production/ \
    $APP_DIR/docker-compose.yml \
    $APP_DIR/nginx/ \
    $APP_DIR/scripts/ \
    --exclude='logs' \
    --exclude='backups' \
    --exclude='node_modules' \
    --exclude='.git'

echo "✅ Files backup: $FILES_BACKUP_FILE"

# Cleanup old backups (keep 7 days)
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Backup summary
echo "📊 Backup summary:"
echo "   Database: $DB_BACKUP_FILE.gz ($(stat -c%s "$BACKUP_DIR/$DB_BACKUP_FILE.gz" | numfmt --to=iec)B)"
echo "   Files: $FILES_BACKUP_FILE ($(stat -c%s "$BACKUP_DIR/$FILES_BACKUP_FILE" | numfmt --to=iec)B)"
echo "   Total space used: $(du -sh $BACKUP_DIR | cut -f1)"

echo "✅ Backup completed successfully!"
```

## Update Script
```bash
#!/bin/bash
# update.sh - Safe application update

set -e

APP_DIR="/home/aarya/aarya-clothing"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🔄 Starting application update..."

# Create backup before update
echo "💾 Creating pre-update backup..."
mkdir -p $BACKUP_DIR
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres pg_dump -U postgres aarya_clothing_prod > $BACKUP_DIR/pre_update_backup_$DATE.sql

# Pull latest code
echo "📥 Pulling latest code..."
cd $APP_DIR
git pull origin main

# Build new images
echo "📦 Building new images..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml build --no-cache

# Restart services with zero downtime
echo "🚀 Deploying update..."
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d --no-deps core commerce payment admin
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d --force-recreate frontend

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🔍 Performing health check..."
if ./production/scripts/health-check.sh; then
    echo "✅ Update successful!"
    
    # Clean up old images
    docker image prune -f
    
    # Remove old backup (keep latest 5)
    ls -t $BACKUP_DIR/pre_update_backup_*.sql | tail -n +6 | xargs -r rm
    
else
    echo "❌ Update failed! Rolling back..."
    # Rollback logic here
    docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml down
    git checkout HEAD~1
    docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d
    echo "🔄 Rolled back to previous version"
    exit 1
fi
```

## Usage Instructions

1. **Make all scripts executable:**
```bash
chmod +x production/scripts/*.sh
```

2. **Run initial setup:**
```bash
./production/scripts/setup-environment.sh
./production/scripts/setup-ssl.sh
./production/scripts/init-database.sh
```

3. **Deploy application:**
```bash
./production/scripts/quick-deploy.sh
```

4. **Monitor health:**
```bash
./production/scripts/health-check.sh
```

5. **Manual backup:**
```bash
./production/scripts/backup.sh
```

6. **Update application:**
```bash
./production/scripts/update.sh
```

## Scheduling with Cron

```bash
# Edit crontab
crontab -e

# Add these lines:
0 2 * * * /home/aarya/aarya-clothing/production/scripts/backup.sh
*/5 * * * * /home/aarya/aarya-clothing/production/scripts/health-check.sh
0 1 * * * /home/aarya/aarya-clothing/production/scripts/daily-maintenance.sh
0 3 * * 0 /home/aarya/aarya-clothing/production/scripts/weekly-maintenance.sh
0 4 1 * * /home/aarya/aarya-clothing/production/scripts/monthly-maintenance.sh
```
