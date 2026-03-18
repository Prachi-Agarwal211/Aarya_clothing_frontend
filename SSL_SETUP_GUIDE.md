# 🔒 SSL Certificate Setup Guide - Aarya Clothing

**Free SSL certificates using Let's Encrypt**

---

## 📋 Prerequisites

1. **Domain configured**: Point your domain `aaryaclothing.in` to your server IP
2. **Port 80 open**: Ensure port 80 is accessible from internet
3. **Email address**: You'll need a valid email for certificate notifications
4. **Root/sudo access**: To run Docker commands

---

## 🚀 Quick Setup (Recommended - Docker Method)

### Step 1: Update Your Email

Edit `setup-ssl-docker.sh` and change the email:

```bash
EMAIL="your-email@example.com"  # Change this!
```

### Step 2: Make Scripts Executable

```bash
chmod +x setup-ssl-docker.sh
chmod +x renew-ssl.sh
```

### Step 3: Run SSL Setup

```bash
./setup-ssl-docker.sh
```

This will:
- ✅ Create necessary directories
- ✅ Obtain SSL certificate from Let's Encrypt
- ✅ Configure nginx with SSL
- ✅ Setup automatic renewal
- ✅ Restart services

### Step 4: Verify SSL

```bash
# Check certificate
openssl x509 -in ./docker/nginx/ssl/fullchain.pem -text -noout

# Visit your site
https://aaryaclothing.in

# Test SSL rating
# https://www.ssllabs.com/ssltest/analyze.html?d=aaryaclothing.in
```

---

## 📁 Certificate Files Structure

```
/opt/Aarya_clothing_frontend/
├── docker/
│   ├── nginx/
│   │   └── ssl/
│   │       ├── fullchain.pem    # Certificate chain
│   │       ├── privkey.pem      # Private key (keep secret!)
│   │       └── chain.pem        # Intermediate certificate
│   └── certbot/
│       ├── conf/                # Let's Encrypt config
│       └── www/                 # Webroot for validation
├── setup-ssl-docker.sh          # Setup script
└── renew-ssl.sh                 # Renewal script
```

---

## 🔄 Certificate Renewal

Let's Encrypt certificates expire after **90 days**. Auto-renewal is configured!

### Manual Renewal

```bash
./renew-ssl.sh
```

### Check Auto-Renewal Logs

```bash
tail -f /var/log/ssl-renewal.log
```

### Verify Cron Job

```bash
crontab -l | grep renew-ssl
# Should show: 0 2 * * * cd /opt/Aarya_clothing_frontend && ./renew-ssl.sh
```

---

## 🔧 Troubleshooting

### Issue: Port 80 Already in Use

**Error**: `Problem binding to port 80: Could not bind to IPv4 or IPv6`

**Solution**: Stop nginx temporarily

```bash
docker-compose stop nginx
./setup-ssl-docker.sh
```

### Issue: Certificate Already Exists

**Error**: `Certificate already exists for this domain`

**Solution**: Force renewal

```bash
docker-compose run --rm certbot renew --force-renewal
```

### Issue: Domain Not Pointing to Server

**Error**: `Failed authorization procedure`

**Solution**: Verify DNS records

```bash
# Check A record
dig aaryaclothing.in

# Should show your server IP
```

### Issue: Firewall Blocking Port 80

**Solution**: Open port 80

```bash
# For UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# For firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 📊 SSL Configuration Details

### Nginx SSL Settings

Located in `docker/nginx/nginx.conf`:

```nginx
# SSL is configured with:
- Modern cipher suites
- TLS 1.2 and 1.3 support
- HSTS (HTTP Strict Transport Security)
- OCSP Stapling (optional)
- Session caching
```

### Security Headers

The nginx config includes:

- ✅ `Strict-Transport-Security` - Force HTTPS
- ✅ `X-Frame-Options` - Prevent clickjacking
- ✅ `X-Content-Type-Options` - Prevent MIME sniffing
- ✅ `X-XSS-Protection` - XSS filter
- ✅ `Content-Security-Policy` - Resource loading control
- ✅ `Referrer-Policy` - Control referrer information

---

## 🎯 Testing SSL

### 1. SSL Labs Test

```
https://www.ssllabs.com/ssltest/analyze.html?d=aaryaclothing.in
```

Target: **A+ rating**

### 2. Check Certificate Info

```bash
openssl s_client -connect aaryaclothing.in:443 -servername aaryaclothing.in
```

### 3. Verify Certificate Expiry

```bash
openssl x509 -enddate -noout -in ./docker/nginx/ssl/fullchain.pem
```

### 4. Test HTTPS Redirect

```bash
curl -I http://aaryaclothing.in
# Should redirect to https://
```

---

## 🛡️ Security Best Practices

### 1. Protect Private Key

```bash
# Ensure private key is readable only by root/nginx
chmod 600 ./docker/nginx/ssl/privkey.pem
ls -la ./docker/nginx/ssl/privkey.pem
```

### 2. Monitor Certificate Expiry

```bash
# Add to crontab for weekly expiry check
0 9 * * 1 openssl x509 -checkend 604800 -noout -in /opt/Aarya_clothing_frontend/docker/nginx/ssl/fullchain.pem && echo "Certificate OK" || echo "Certificate expiring soon!"
```

### 3. Backup Certificates

```bash
# Create backup
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz ./docker/nginx/ssl/

# Store securely
```

---

## 📈 Monitoring

### Certificate Expiry Alert

Create `/opt/Aarya_clothing_frontend/check-ssl-expiry.sh`:

```bash
#!/bin/bash
CERT_FILE="./docker/nginx/ssl/fullchain.pem"
DAYS_THRESHOLD=30

EXPIRY_DATE=$(openssl x509 -enddate -noout -in $CERT_FILE | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt $DAYS_THRESHOLD ]; then
    echo "⚠️  WARNING: SSL certificate expires in $DAYS_LEFT days!"
    echo "Expiry date: $EXPIRY_DATE"
    # Send email alert here
    exit 1
else
    echo "✅ SSL certificate valid for $DAYS_LEFT days"
    exit 0
fi
```

---

## 🆘 Emergency: Certificate Expired

If certificate expires:

```bash
# 1. Stop nginx
docker-compose stop nginx

# 2. Force renew
docker run --rm \
    -v ./docker/certbot/conf:/etc/letsencrypt \
    -v ./docker/certbot/www:/var/www/certbot \
    certbot/certbot renew --force-renewal

# 3. Copy new certs
cp ./docker/certbot/conf/live/aaryaclothing.in/fullchain.pem ./docker/nginx/ssl/
cp ./docker/certbot/conf/live/aaryaclothing.in/privkey.pem ./docker/nginx/ssl/

# 4. Restart nginx
docker-compose restart nginx
```

---

## 📞 Support

### Let's Encrypt Documentation
- https://letsencrypt.org/docs/
- https://certbot.eff.org/docs/

### Community Forum
- https://community.letsencrypt.org/

### SSL Configuration Generator
- https://ssl-config.mozilla.org/

---

## ✅ Checklist

- [ ] Email updated in setup script
- [ ] DNS records configured (A record points to server)
- [ ] Port 80 accessible from internet
- [ ] Setup script executed successfully
- [ ] HTTPS working (https://aaryaclothing.in)
- [ ] SSL Labs test shows A+ rating
- [ ] Auto-renewal cron job configured
- [ ] Certificate expiry monitoring setup
- [ ] Private key permissions secured (600)
- [ ] Backup of certificates created

---

**Last Updated**: March 18, 2026  
**Certificate Authority**: Let's Encrypt  
**Validity**: 90 days (auto-renewal enabled)
