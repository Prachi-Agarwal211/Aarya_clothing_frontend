# Aarya Clothing - Quick Reference Card

## 🚀 Quick Start

### Deploy Production (Automated)
```bash
cd /opt/Aarya_clothing_frontend
sudo bash scripts/deploy_production.sh
```

### Manual Deployment
```bash
cd /opt/Aarya_clothing_frontend
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose ps
```

---

## 🔐 Security Commands

### Generate Secure Passwords
```bash
# PostgreSQL/Redis password
openssl rand -base64 32

# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# Any secure string
openssl rand -hex 32
```

### SSL Certificate
```bash
# Get certificate
sudo certbot certonly --standalone -d aaryaclothing.in -d www.aaryaclothing.in

# Renew certificate
sudo certbot renew

# Force renew
sudo certbot renew --force-renewal
```

### Firewall (UFW)
```bash
# Enable
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Check status
sudo ufw status verbose
```

---

## 📊 Monitoring

### Container Status
```bash
# All containers
docker-compose ps

# Detailed status
docker stats

# Specific service
docker-compose ps commerce
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker logs -f aarya_commerce

# Last 100 lines
docker logs --tail=100 aarya_nginx

# Save logs
docker-compose logs > logs_$(date +%Y%m%d).txt
```

### Health Checks
```bash
# Frontend
curl -I https://aaryaclothing.in

# API Health
curl https://aaryaclothing.in/health

# Products API
curl https://aaryaclothing.in/api/v1/products?limit=5

# Security headers
curl -I https://aaryaclothing.in | grep -E "Strict|X-Frame|X-Content"
```

---

## 🗄️ Database

### Connect to PostgreSQL
```bash
docker exec -it aarya_postgres psql -U postgres -d aarya_clothing
```

### Common Queries
```sql
-- Count records
SELECT 'products' as table_name, COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'users', COUNT(*) FROM users;

-- Recent orders
SELECT id, total_amount, status, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Low stock products
SELECT p.name, i.quantity, i.sku
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.quantity <= i.low_stock_threshold;

-- Database size
SELECT pg_size_pretty(pg_database_size('aarya_clothing'));
```

### Backup & Restore
```bash
# Backup
docker exec aarya_postgres pg_dump -U postgres aarya_clothing > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < backup.sql

# List backups
ls -lh backup_*.sql
```

---

## 🧪 Testing

### Run Tests
```bash
# Backend tests
docker-compose run --rm commerce pytest tests/ -v

# With coverage
docker-compose run --rm commerce pytest --cov=services/commerce -v

# Frontend tests
cd frontend_new
npm test

# E2E tests
cd frontend_new
npx playwright test
```

---

## 🔧 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker logs aarya_<service>

# Restart service
docker-compose restart <service>

# Rebuild service
docker-compose build <service>
docker-compose up -d <service>
```

### Database Connection Failed
```bash
# Check PostgreSQL
docker exec aarya_postgres pg_isready -U postgres

# Restart PostgreSQL
docker-compose restart postgres

# Test connection
docker exec aarya_commerce python -c "
import psycopg2, os
psycopg2.connect(os.getenv('DATABASE_URL'))
print('OK')
"
```

### Out of Disk Space
```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes -f

# Remove old images
docker image prune -a -f
```

### Out of Memory
```bash
# Check memory
free -h
docker stats --no-stream

# Restart memory-heavy services
docker-compose restart commerce admin
```

### HTTPS Not Working
```bash
# Check certificate
sudo ls -la /etc/letsencrypt/live/aaryaclothing.in/

# Test SSL
curl -vI https://aaryaclothing.in

# Check nginx config
docker exec aarya_nginx nginx -t

# Reload nginx
docker exec aarya_nginx nginx -s reload
```

---

## 📝 Environment Variables

### Required Production Values
```bash
# Edit .env
nano .env

# Key variables:
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<generated>
POSTGRES_PASSWORD=<generated>
REDIS_PASSWORD=<generated>
NEXT_PUBLIC_API_URL=https://aaryaclothing.in
COOKIE_SECURE=true
```

### Update .env and Restart
```bash
# After editing .env
docker-compose down
docker-compose up -d
```

---

## 🛠️ Common Tasks

### Add New Product (via API)
```bash
# Get admin token
TOKEN=$(curl -X POST https://aaryaclothing.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>}' \
  | jq -r '.access_token')

# Create product
curl -X POST https://aaryaclothing.in/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "base_price": 999,
    "category_id": 1
  }'
```

### Clear Cache
```bash
# Redis cache
docker exec aarya_redis redis-cli -a $REDIS_PASSWORD FLUSHDB

# Application cache (restart service)
docker-compose restart commerce
```

### Update Code
```bash
# Pull latest
cd /opt/Aarya_clothing_frontend
git pull origin main

# Rebuild and restart
docker-compose build
docker-compose up -d
```

---

## 📞 Emergency Contacts

### Rollback to Previous Version
```bash
# Stop current
docker-compose down

# Revert git
git reset --hard HEAD~1

# Rebuild
docker-compose build
docker-compose up -d
```

### Emergency Stop
```bash
# Stop all services
docker-compose down

# Stop Docker entirely
systemctl stop docker
```

---

## 📋 Checklist

### Pre-Deployment
- [ ] Backup database
- [ ] Test in staging
- [ ] Notify team
- [ ] Check disk space (>5GB)
- [ ] Check memory (>2GB)

### Post-Deployment
- [ ] Health check passes
- [ ] HTTPS working
- [ ] API responding
- [ ] Login works
- [ ] Products display
- [ ] Cart functions
- [ ] Security headers present
- [ ] Logs clean (no errors)

### Daily Operations
- [ ] Check container status
- [ ] Review error logs
- [ ] Monitor disk usage
- [ ] Check backup status
- [ ] Verify SSL expiry

---

**Quick Help:** `cat PRODUCTION_FIX_GUIDE.md` for full documentation
