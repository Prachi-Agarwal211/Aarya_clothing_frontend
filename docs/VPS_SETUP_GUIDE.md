# VPS Production Setup Guide - Aarya Clothing E-commerce

## Overview
This guide provides step-by-step instructions for deploying the Aarya Clothing e-commerce platform on a production VPS.

## Prerequisites
- Ubuntu 22.04 LTS or CentOS 8+ 
- Minimum 4GB RAM, 2 CPU cores
- 50GB+ storage SSD
- Domain name pointed to VPS IP
- SSL certificate (Let's Encrypt recommended)

## Table of Contents
1. [Server Setup](#server-setup)
2. [Docker Installation](#docker-installation)
3. [Application Setup](#application-setup)
4. [Database Configuration](#database-configuration)
5. [SSL Certificate Setup](#ssl-certificate-setup)
6. [Environment Variables](#environment-variables)
7. [Service Deployment](#service-deployment)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup Strategy](#backup-strategy)
10. [Security Hardening](#security-hardening)
11. [Performance Optimization](#performance-optimization)
12. [Maintenance Tasks](#maintenance-tasks)

---

## 1. Server Setup

### 1.1 System Updates
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip htop vim

# CentOS/RHEL
sudo yum update -y
sudo yum install -y curl wget git unzip htop vim
```

### 1.2 Create Application User
```bash
# Create dedicated user for the application
sudo adduser aarya
sudo usermod -aG sudo aarya
sudo su - aarya
```

### 1.3 Firewall Configuration
```bash
# Ubuntu (UFW)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 1.4 Set Timezone
```bash
sudo timedatectl set-timezone Asia/Kolkata
# Or your preferred timezone
```

---

## 2. Docker Installation

### 2.1 Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker aarya
newgrp docker
```

### 2.2 Install Docker Compose
```bash
# Download latest Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2.3 Configure Docker to start on boot
```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 3. Application Setup

### 3.1 Clone Repository
```bash
# Clone the application
cd /home/aarya
git clone <your-repository-url> aarya-clothing
cd aarya-clothing
```

### 3.2 Create Production Environment Files
```bash
# Create production environment directory
mkdir -p production/env

# Create production compose file
cp docker-compose.yml production/docker-compose.prod.yml
```

### 3.3 Create Production Docker Compose Override
```bash
# Create production/docker-compose.prod.yml
cat > production/docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  # ============================================================
  # CORE SERVICE - Production
  # ============================================================
  core:
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
      - LOG_LEVEL=INFO
    volumes:
      - ./logs/core:/app/logs
    # Remove volume mounts for production (use built image)

  # ============================================================
  # COMMERCE SERVICE - Production
  # ============================================================
  commerce:
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
      - LOG_LEVEL=INFO
    volumes:
      - ./logs/commerce:/app/logs

  # ============================================================
  # PAYMENT SERVICE - Production
  # ============================================================
  payment:
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
      - LOG_LEVEL=INFO
    volumes:
      - ./logs/payment:/app/logs

  # ============================================================
  # ADMIN SERVICE - Production
  # ============================================================
  admin:
    restart: unless-stopped
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
      - LOG_LEVEL=INFO
    volumes:
      - ./logs/admin:/app/logs

  # ============================================================
  # FRONTEND - Production Build
  # ============================================================
  frontend:
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://your-domain.com
    # Remove development volume mounts

  # ============================================================
  # POSTGRES - Production
  # ============================================================
  postgres:
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-aarya_clothing_prod}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
      - ./backups:/backups
    secrets:
      - postgres_password

  # ============================================================
  # REDIS - Production
  # ============================================================
  redis:
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data_prod:/data

  # ============================================================
  # MEILISEARCH - Production
  # ============================================================
  meilisearch:
    restart: unless-stopped
    environment:
      - MEILI_MASTER_KEY_FILE=/run/secrets/meili_master_key
    volumes:
      - meilisearch_data_prod:/meili_data
    secrets:
      - meili_master_key

  # ============================================================
  # NGINX - Production with SSL
  # ============================================================
  nginx:
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
      - certbot_certs:/etc/letsencrypt:ro

volumes:
  postgres_data_prod:
  redis_data_prod:
  meilisearch_data_prod:
  certbot_certs:

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  meili_master_key:
    file: ./secrets/meili_master_key.txt

networks:
  default:
    driver: bridge
EOF
```

---

## 4. Database Configuration

### 4.1 Create Secrets
```bash
# Create secrets directory
mkdir -p production/secrets

# Generate secure passwords
openssl rand -base64 32 > production/secrets/postgres_password.txt
openssl rand -base64 32 > production/secrets/meili_master_key.txt
openssl rand -base64 32 > production/secrets/jwt_secret.txt
openssl rand -base64 32 > production/secrets/redis_password.txt

# Set proper permissions
chmod 600 production/secrets/*
```

### 4.2 Create Production Environment File
```bash
# Create production/.env
cat > production/.env << 'EOF'
# Database Configuration
POSTGRES_DB=aarya_clothing_prod
POSTGRES_USER=postgres
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

# Redis Configuration
REDIS_PASSWORD_FILE=/run/secrets/redis_password.txt

# JWT Configuration
SECRET_KEY_FILE=/run/secrets/jwt_secret.txt
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=1440

# Application Configuration
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
DOMAIN=your-domain.com

# SSL Configuration
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=strict

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD_FILE=/run/secrets/smtp_password.txt
EMAIL_FROM=noreply@your-domain.com
EMAIL_FROM_NAME=Aarya Clothing

# R2 Storage Configuration
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY_FILE=/run/secrets/r2_secret.txt
R2_BUCKET_NAME=aarya-clothing-images
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

# Payment Configuration
STRIPE_SECRET_KEY_FILE=/run/secrets/stripe_secret.txt
STRIPE_WEBHOOK_SECRET_FILE=/run/secrets/stripe_webhook.txt
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET_FILE=/run/secrets/razorpay_secret.txt
RAZORPAY_WEBHOOK_SECRET_FILE=/run/secrets/razorpay_webhook.txt

# Meilisearch Configuration
MEILISEARCH_URL=http://meilisearch:7700
MEILI_MASTER_KEY_FILE=/run/secrets/meili_master_key.txt
EOF
```

### 4.3 Initialize Database
```bash
# Start only PostgreSQL for initialization
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL to be ready
sleep 30

# Run database initialization
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -f /docker-entrypoint-initdb.d/init.sql

# Verify initialization
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -c "SELECT email, role FROM users;"
```

---

## 5. SSL Certificate Setup

### 5.1 Install Certbot
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 5.2 Create Nginx Configuration
```bash
# Create nginx directory
mkdir -p production/nginx

# Create production Nginx config
cat > production/nginx/nginx.prod.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Upstream servers
    upstream core {
        server core:5001;
    }

    upstream commerce {
        server commerce:5002;
    }

    upstream payment {
        server payment:5003;
    }

    upstream admin {
        server admin:5004;
    }

    upstream frontend {
        server frontend:3000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;
        
        # Let's Encrypt verification
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        # Redirect all other traffic to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        # SSL configuration
        ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API routes with rate limiting
        location /api/v1/auth/login {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://core;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/v1/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://core;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Admin routes
        location /admin/ {
            proxy_pass http://admin;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Commerce routes
        location /commerce/ {
            proxy_pass http://commerce;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Payment routes
        location /payment/ {
            proxy_pass http://payment;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
```

### 5.3 Obtain SSL Certificate
```bash
# Create certbot directory
mkdir -p /var/www/certbot

# Obtain SSL certificate (replace with your domain)
sudo certbot certonly --nginx -d your-domain.com -d www.your-domain.com --email your-email@gmail.com --agree-tos --no-eff-email

# Test automatic renewal
sudo certbot renew --dry-run
```

### 5.4 Setup Auto-renewal
```bash
# Add cron job for auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /home/aarya/aarya-clothing/docker-compose.yml -f /home/aarya/aarya-clothing/production/docker-compose.prod.yml restart nginx
```

---

## 6. Environment Variables Setup

### 6.1 Create Additional Secret Files
```bash
# Create additional secret files
echo "your-smtp-password" > production/secrets/smtp_password.txt
echo "your-r2-secret-key" > production/secrets/r2_secret.txt
echo "your-stripe-secret-key" > production/secrets/stripe_secret.txt
echo "your-stripe-webhook-secret" > production/secrets/stripe_webhook.txt
echo "your-razorpay-secret" > production/secrets/razorpay_secret.txt
echo "your-razorpay-webhook-secret" > production/secrets/razorpay_webhook.txt

# Set permissions
chmod 600 production/secrets/*
```

### 6.2 Update Domain in Configuration
```bash
# Replace your-domain.com with actual domain in all config files
sed -i 's/your-domain.com/your-actual-domain.com/g' production/nginx/nginx.prod.conf
sed -i 's/your-domain.com/your-actual-domain.com/g' production/.env
```

---

## 7. Service Deployment

### 7.1 Build Production Images
```bash
# Build all services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml build

# Build frontend specifically (production mode)
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml build --no-cache frontend
```

### 7.2 Deploy All Services
```bash
# Start all services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml logs -f
```

### 7.3 Verify Deployment
```bash
# Test individual services
curl -k https://your-domain.com/health
curl -k https://your-domain.com/api/v1/landing/all
curl -k https://your-domain.com/admin/health
```

---

## 8. Monitoring & Logging

### 8.1 Setup Log Rotation
```bash
# Create logrotate config
sudo tee /etc/logrotate.d/aarya-clothing << 'EOF'
/home/aarya/aarya-clothing/logs/*/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 aarya aarya
    postrotate
        docker-compose -f /home/aarya/aarya-clothing/docker-compose.yml -f /home/aarya/aarya-clothing/production/docker-compose.prod.yml restart nginx
    endscript
}
EOF
```

### 8.2 Setup Monitoring Script
```bash
# Create monitoring script
cat > production/scripts/monitor.sh << 'EOF'
#!/bin/bash

# Health check script
SERVICES=("core" "commerce" "payment" "admin" "frontend" "postgres" "redis" "meilisearch" "nginx")
WEBHOOK_URL="your-monitoring-webhook-url"

for service in "${SERVICES[@]}"; do
    if ! docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml ps $service | grep -q "Up"; then
        echo "ALERT: $service is down"
        # Send webhook notification
        curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"$service is down on production\"}"
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%"
    curl -X POST $WEBHOOK_URL -H 'Content-type: application/json' --data "{\"text\":\"Disk usage is ${DISK_USAGE}% on production\"}"
fi
EOF

chmod +x production/scripts/monitor.sh

# Add to cron
echo "*/5 * * * * /home/aarya/aarya-clothing/production/scripts/monitor.sh" | crontab -
```

---

## 9. Backup Strategy

### 9.1 Database Backup Script
```bash
# Create backup script
cat > production/scripts/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/home/aarya/aarya-clothing/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="aarya_clothing_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres pg_dump -U postgres aarya_clothing_prod > $BACKUP_DIR/$BACKUP_FILE

# Compress backup
gzip $BACKUP_DIR/$BACKUP_FILE

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF

chmod +x production/scripts/backup.sh

# Schedule daily backups at 2 AM
echo "0 2 * * * /home/aarya/aarya-clothing/production/scripts/backup.sh" | crontab -
```

### 9.2 File Backup Script
```bash
# Create file backup script
cat > production/scripts/backup-files.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/home/aarya/aarya-clothing/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILES_BACKUP="files_backup_$DATE.tar.gz"

# Backup important files and configurations
tar -czf $BACKUP_DIR/$FILES_BACKUP \
    production/ \
    docker-compose.yml \
    nginx/ \
    scripts/ \
    --exclude='logs' \
    --exclude='backups' \
    --exclude='node_modules' \
    --exclude='.git'

echo "Files backup completed: $FILES_BACKUP"
EOF

chmod +x production/scripts/backup-files.sh

# Schedule weekly file backups
echo "0 3 * * 0 /home/aarya/aarya-clothing/production/scripts/backup-files.sh" | crontab -
```

---

## 10. Security Hardening

### 10.1 SSH Security
```bash
# Edit SSH configuration
sudo vim /etc/ssh/sshd_config

# Recommended settings:
# Port 2222 (change from 22)
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes
# MaxAuthTries 3

# Restart SSH
sudo systemctl restart ssh
```

### 10.2 Fail2Ban Setup
```bash
# Install fail2ban
sudo apt install -y fail2ban

# Create configuration
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 10.3 Docker Security
```bash
# Create docker security daemon config
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true
}
EOF

sudo systemctl restart docker
```

---

## 11. Performance Optimization

### 11.1 Database Optimization
```bash
# Create PostgreSQL optimization config
cat > production/postgres/postgresql.conf << 'EOF'
# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Connection settings
max_connections = 100
work_mem = 4MB

# Logging settings
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
EOF
```

### 11.2 Redis Optimization
```bash
# Update Redis configuration in production compose
# Add to redis service in docker-compose.prod.yml:
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### 11.3 Nginx Optimization
```bash
# Add to nginx.prod.conf http block:
worker_processes auto;
worker_rlimit_nofile 65535;

# Add to server blocks:
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 12. Maintenance Tasks

### 12.1 Daily Maintenance Checklist
```bash
# Create daily maintenance script
cat > production/scripts/daily-maintenance.sh << 'EOF'
#!/bin/bash

echo "Starting daily maintenance..."

# Clean up Docker unused resources
docker system prune -f

# Rotate logs
sudo logrotate -f /etc/logrotate.d/aarya-clothing

# Check service health
/home/aarya/aarya-clothing/production/scripts/monitor.sh

# Update SSL certificates if needed
sudo certbot renew --quiet

echo "Daily maintenance completed"
EOF

chmod +x production/scripts/daily-maintenance.sh

# Schedule at 1 AM daily
echo "0 1 * * * /home/aarya/aarya-clothing/production/scripts/daily-maintenance.sh" | crontab -
```

### 12.2 Weekly Maintenance Checklist
```bash
# Create weekly maintenance script
cat > production/scripts/weekly-maintenance.sh << 'EOF'
#!/bin/bash

echo "Starting weekly maintenance..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean up old backups
find /home/aarya/aarya-clothing/backups -name "*.gz" -mtime +30 -delete

# Restart services gracefully
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml restart

echo "Weekly maintenance completed"
EOF

chmod +x production/scripts/weekly-maintenance.sh

# Schedule on Sundays at 3 AM
echo "0 3 * * 0 /home/aarya/aarya-clothing/production/scripts/weekly-maintenance.sh" | crontab -
```

### 12.3 Monthly Maintenance Checklist
```bash
# Create monthly maintenance script
cat > production/scripts/monthly-maintenance.sh << 'EOF'
#!/bin/bash

echo "Starting monthly maintenance..."

# Database maintenance
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod -c "VACUUM ANALYZE;"

# Update application
cd /home/aarya/aarya-clothing
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d

echo "Monthly maintenance completed"
EOF

chmod +x production/scripts/monthly-maintenance.sh

# Schedule on 1st of each month at 4 AM
echo "0 4 1 * * /home/aarya/aarya-clothing/production/scripts/monthly-maintenance.sh" | crontab -
```

---

## Emergency Procedures

### Database Recovery
```bash
# Restore database from backup
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml exec postgres psql -U postgres -d aarya_clothing_prod < backup_file.sql
```

### Service Recovery
```bash
# Restart all services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml restart

# Rebuild specific service
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d --build service-name
```

### Complete System Recovery
```bash
# Stop all services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml down

# Restore files from backup
tar -xzf files_backup.tar.gz

# Start services
docker-compose -f docker-compose.yml -f production/docker-compose.prod.yml up -d
```

---

## Contact Information

- **Technical Support**: [Your Email]
- **Emergency Contact**: [Your Phone]
- **Documentation**: [Link to Documentation]

---

## Notes

1. Always test backups regularly
2. Monitor disk space and system resources
3. Keep all software updated
4. Review security logs periodically
5. Test disaster recovery procedures quarterly

---

*Last Updated: $(date)*
*Version: 1.0*
