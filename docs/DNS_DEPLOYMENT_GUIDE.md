# 🌐 DNS & DEPLOYMENT CONFIGURATION GUIDE
## Aarya Clothing - Hostinger + Docker Deployment

**Generated:** March 16, 2026  
**Domain:** aaryaclothing.in  
**Hosting:** Self-hosted Docker on VPS  
**DNS Provider:** Hostinger

---

## 📊 CURRENT DNS CONFIGURATION ANALYSIS

### ✅ **CORRECTLY CONFIGURED**

| Type | Host | Value | Priority | Status |
|------|------|-------|----------|--------|
| **ALIAS** | @ | aaryaclothing.in.cdn.hstgr.net | - | ✅ Points to Hostinger |
| **CNAME** | www | www.aaryaclothing.in.cdn.hstgr.net | - | ✅ WWW redirect |
| **MX** | @ | mx1.hostinger.com | 5 | ✅ Primary mail |
| **MX** | @ | mx2.hostinger.com | 10 | ✅ Backup mail |
| **TXT** | @ | v=spf1 include:_spf.mail.hostinger.com ~all | - | ✅ SPF record |
| **TXT** | _dmarc | v=DMARC1; p=none | - | ✅ DMARC policy |
| **CNAME** | autodiscover | autodiscover.mail.hostinger.com | - | ✅ Email autoconfig |
| **CNAME** | autoconfig | autoconfig.mail.hostinger.com | - | ✅ Email autoconfig |
| **CNAME** | hostingermail-a._domainkey | hostingermail-a.dkim.mail.hostinger.com | - | ✅ DKIM |
| **CNAME** | hostingermail-b._domainkey | hostingermail-b.dkim.mail.hostinger.com | - | ✅ DKIM |
| **CNAME** | hostingermail-c._domainkey | hostingermail-c.dkim.mail.hostinger.com | - | ✅ DKIM |

---

## 🔴 **CRITICAL ISSUE: DOMAIN NOT POINTING TO YOUR DOCKER SERVER**

### **Current Problem:**
Your DNS records show:
```
ALIAS @ → aaryaclothing.in.cdn.hstgr.net (Hostinger's shared hosting)
CNAME www → www.aaryaclothing.in.cdn.hstgr.net (Hostinger's shared hosting)
```

**This means your domain is pointing to Hostinger's servers, NOT your Docker server!**

---

## ✅ **SOLUTION: POINT DOMAIN TO YOUR DOCKER SERVER**

### **Step 1: Get Your Server's Public IP**

Find your VPS/server public IP address:
```bash
# Run this on your server
curl ifconfig.me
# or
curl ipinfo.io/ip
# or
hostname -I | awk '{print $1}'
```

**Example:** Let's say your server IP is `203.0.113.45`

---

### **Step 2: Update DNS Records in Hostinger**

You need to **change** these DNS records:

#### **Option A: Point Domain Directly to Server IP (Recommended)**

| Type | Host | Value | TTL | Action |
|------|------|-------|-----|--------|
| **A** | @ | `YOUR_SERVER_IP` | 300 | **ADD/REPLACE ALIAS** |
| **A** | www | `YOUR_SERVER_IP` | 300 | **ADD/REPLACE CNAME** |

**In Hostinger DNS Management:**

1. **DELETE** the ALIAS record for `@`
2. **DELETE** the CNAME record for `www`
3. **ADD** new A record:
   - Type: **A**
   - Host: **@**
   - Value: **YOUR_SERVER_IP** (e.g., `203.0.113.45`)
   - TTL: **300**

4. **ADD** new A record:
   - Type: **A**
   - Host: **www**
   - Value: **YOUR_SERVER_IP** (e.g., `203.0.113.45`)
   - TTL: **300**

---

#### **Option B: Use Cloudflare Proxy (Recommended for Production)**

1. **Sign up for Cloudflare** (free tier is excellent)
2. **Add your domain** (aaryaclothing.in)
3. **Update nameservers** at Hostinger to Cloudflare's nameservers
4. **Add DNS records in Cloudflare:**

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| **A** | @ | YOUR_SERVER_IP | 🟠 Proxied | Auto |
| **A** | www | YOUR_SERVER_IP | 🟠 Proxied | Auto |
| **MX** | @ | mx1.hostinger.com | ⚪ DNS only | Auto |
| **MX** | @ | mx2.hostinger.com | ⚪ DNS only | Auto |
| **TXT** | @ | v=spf1... | ⚪ DNS only | Auto |

**Benefits of Cloudflare:**
- ✅ Free SSL/TLS (HTTPS automatically)
- ✅ DDoS protection
- ✅ CDN for faster loading
- ✅ Web Application Firewall (WAF)
- ✅ Automatic HTTPS redirects

---

## 🔧 **DOCKER CONFIGURATION FOR PRODUCTION**

### **Step 3: Update docker-compose.yml**

Your current `docker-compose.yml` has:
```yaml
ports:
  - "6005:80"  # NGINX exposed on port 6005
```

**For production, you should:**

1. **Use standard HTTP/HTTPS ports:**
```yaml
nginx:
  ports:
    - "80:80"   # HTTP
    - "443:443" # HTTPS (with SSL)
```

2. **Or keep 6005 for testing, use reverse proxy**

---

### **Step 4: Update NGINX Configuration for Production**

Edit `docker/nginx/nginx.conf`:

**Change server_name:**
```nginx
server {
    listen 80;
    server_name aaryaclothing.in www.aaryaclothing.in;  # ← Change from localhost
    
    # ... rest of config
}
```

**Add HTTPS redirect (after you get SSL):**
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name aaryaclothing.in www.aaryaclothing.in;
    
    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name aaryaclothing.in www.aaryaclothing.in;
    
    ssl_certificate /etc/letsencrypt/live/aaryaclothing.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aaryaclothing.in/privkey.pem;
    
    # ... rest of config
}
```

---

### **Step 5: Update Environment Variables**

Create `.env` file in project root:

```bash
# Production Environment Variables
cp .env.example .env
```

**Edit `.env`:**
```bash
# Server Configuration
ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://aaryaclothing.in

# Security - CHANGE THESE!
SECRET_KEY=your_super_secret_key_min_32_chars
POSTGRES_PASSWORD=strong_random_password_32_chars
REDIS_PASSWORD=strong_random_password_32_chars
MEILI_MASTER_KEY=strong_random_password_32_chars

# Cookie Settings
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=lax

# Allowed Origins
ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]

# Payment Gateway
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENV=PRODUCTION

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Cloudflare R2 (Optional for images)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=aarya-clothing-images
R2_PUBLIC_URL=https://cdn.aaryaclothing.in
```

---

## 🔒 **SSL/TLS CERTIFICATE (HTTPS)**

### **Option 1: Let's Encrypt (Free, Recommended)**

**Install Certbot:**
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

**Get Certificate:**
```bash
# Stop nginx container first
docker-compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d aaryaclothing.in -d www.aaryaclothing.in

# Follow prompts to enter email and agree to terms
```

**Certificate Location:**
```
/etc/letsencrypt/live/aaryaclothing.in/fullchain.pem
/etc/letsencrypt/live/aaryaclothing.in/privkey.pem
```

**Update docker-compose.yml to mount certificates:**
```yaml
nginx:
  volumes:
    - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

**Auto-renewal:**
```bash
# Add to crontab
sudo crontab -e

# Add this line (renews daily at 3am)
0 3 * * * certbot renew --quiet
```

---

### **Option 2: Cloudflare SSL (Easiest)**

If using Cloudflare (recommended):

1. **Enable SSL in Cloudflare dashboard:**
   - Go to SSL/TLS → Overview
   - Select **"Full"** or **"Full (strict)"**

2. **Origin Certificate:**
   - Go to SSL/TLS → Origin Server
   - Create Certificate
   - Install in nginx container

---

## 🚀 **DEPLOYMENT STEPS**

### **Complete Deployment Checklist:**

#### **1. Prepare Server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### **2. Clone/Upload Code**
```bash
# SSH to server
ssh user@your_server_ip

# Clone repository
cd /var/www
git clone https://github.com/yourusername/aarya_clothing_frontend.git
cd aarya_clothing_frontend

# Or upload via SCP/rsync
```

#### **3. Configure Environment**
```bash
# Create .env file
cp .env.example .env
nano .env

# Edit all production values
```

#### **4. Update DNS**
- Update DNS records in Hostinger (as shown above)
- Wait for DNS propagation (5-30 minutes)

#### **5. Get SSL Certificate**
```bash
# Get Let's Encrypt certificate
sudo certbot certonly --standalone -d aaryaclothing.in -d www.aaryaclothing.in
```

#### **6. Update NGINX Config**
```bash
# Edit nginx.conf for production
nano docker/nginx/nginx.conf

# Change server_name to your domain
```

#### **7. Start Services**
```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### **8. Verify Deployment**
```bash
# Test frontend
curl https://aaryaclothing.in

# Test API
curl https://aaryaclothing.in/health

# Test all services
curl https://aaryaclothing.in/api/v1/products
```

#### **9. Initialize Database**
```bash
# Run database migrations
docker-compose exec core python -c "from database.database import init_db; init_db()"

# Or manually run init.sql
docker-compose exec postgres psql -U postgres -d aarya_clothing -f /docker-entrypoint-initdb.d/init.sql
```

#### **10. Add Performance Indexes**
```bash
docker-compose exec postgres psql -U postgres -d aarya_clothing -f docker/postgres/add_indexes.sql
```

---

## 🧪 **TESTING DEPLOYMENT**

### **Test All Endpoints:**

```bash
# Frontend
curl https://aaryaclothing.in

# Health check
curl https://aaryaclothing.in/health

# Products API
curl https://aaryaclothing.in/api/v1/products

# Auth (should return 401 without token)
curl https://aaryaclothing.in/api/v1/users/me

# Admin (should return 403 without admin role)
curl https://aaryaclothing.in/api/v1/admin/dashboard
```

### **Test Role-Based Access:**

```bash
# Login as customer
curl -X POST https://aaryaclothing.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"test123"}'

# Save token and test protected routes
TOKEN="your_access_token"

curl https://aaryaclothing.in/api/v1/cart \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔧 **TROUBLESHOOTING**

### **Issue: DNS Not Propagating**

**Check DNS propagation:**
```bash
# Use dig to check DNS
dig aaryaclothing.in
dig www.aaryaclothing.in

# Or use online tools
# https://dnschecker.org/
```

**Wait time:** DNS changes can take 24-48 hours to fully propagate, but usually 5-30 minutes.

---

### **Issue: Connection Refused**

**Check if Docker containers are running:**
```bash
docker-compose ps
```

**Check firewall:**
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or allow all (for testing)
sudo ufw allow 6005/tcp
```

---

### **Issue: SSL Certificate Errors**

**Verify certificate paths:**
```bash
ls -la /etc/letsencrypt/live/aaryaclothing.in/
```

**Restart nginx:**
```bash
docker-compose restart nginx
```

---

### **Issue: Backend Services Not Responding**

**Check service logs:**
```bash
docker-compose logs core
docker-compose logs commerce
docker-compose logs admin
```

**Verify database connection:**
```bash
docker-compose exec postgres psql -U postgres -d aarya_clothing -c "SELECT 1"
```

---

## 📊 **MONITORING & MAINTENANCE**

### **Set Up Monitoring:**

1. **Install Docker monitoring:**
```bash
docker stats
```

2. **Set up log rotation:**
```bash
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

3. **Set up uptime monitoring:**
- Use UptimeRobot (free)
- Monitor https://aaryaclothing.in/health
- Get alerts when site is down

---

## 🎯 **QUICK DEPLOYMENT SUMMARY**

### **Minimal Steps to Go Live:**

1. ✅ **Get server public IP**
2. ✅ **Update DNS in Hostinger** (A records → your server IP)
3. ✅ **Create .env file** with production values
4. ✅ **Get SSL certificate** (Let's Encrypt)
5. ✅ **Update nginx.conf** server_name
6. ✅ **Start Docker containers:** `docker-compose up -d`
7. ✅ **Test:** https://aaryaclothing.in

---

## 📞 **NEXT STEPS**

1. **Tell me your server's public IP** and I'll give you exact DNS records
2. **Decide:** Direct DNS (faster) or Cloudflare (more features)
3. **Create .env file** with production secrets
4. **Get SSL certificate**
5. **Deploy!**

---

**Need help?** Run these commands and share the output:
```bash
# Your server IP
curl ifconfig.me

# Current DNS
dig aaryaclothing.in

# Docker status
docker-compose ps
```
