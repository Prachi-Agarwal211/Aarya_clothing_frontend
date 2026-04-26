# Website Maintenance Mode - Implementation Guide

**Document Version:** 1.0.0  
**Last Updated:** April 2025  
**Created By:** Aarya Clothing Dev Team  

---

## 📋 OVERVIEW

This document outlines the implementation of a **maintenance mode** for [aaryaclothing.in](https://aaryaclothing.in) that displays a maintenance message to public visitors while keeping **admin access and order processing functional**.

### Goal
- Show maintenance message to all **public visitors**
- Keep **admin login and dashboard** fully accessible
- Keep **all API endpoints** operational for order processing
- **Zero downtime** - no services stopped or restarted

---

## 🎯 REQUIREMENTS

### Must Have
✅ Maintenance message displayed to public visitors  
✅ Admin login page (`/auth/*`) accessible  
✅ Admin dashboard (`/admin/*`) fully functional  
✅ All API endpoints (`/api/v1/*`) operational  
✅ Order processing continues normally  
✅ No container restarts (zero downtime)  

### Nice to Have
- Maintenance page with estimated resume time  
- Bypass option via special URL/query parameter (for testing)  
- IP whitelist option for additional access control  

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX Reverse Proxy                          │
│                        (Ports 80 & 443)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request Incoming → Check URL against allowed patterns         │
│                                                                  │
│  ┌─────────────────────────────┐   ┌─────────────────────────┐ │
│  │      ALLOWED PATTERNS         │   │     MAINTENANCE PAGE      │ │
│  │  (Serve normally from backend)│   │  (Serve static HTML)     │ │
│  ├─────────────────────────────┤   ├─────────────────────────┤ │
│  │ /auth/*                      │   │ /                        │ │
│  │ /admin/*                     │   │ /products/*             │ │
│  │ /api/v1/*                    │   │ /collections/*           │ │
│  │ /_next/*                     │   │ /cart/*                 │ │
│  │ /api/payment/webhook         │   │ /checkout/*             │ │
│  │ /logo.png                    │   │ /faq/*                  │ │
│  │ /favicon.ico                │   │ /contact/*              │ │
│  │                             │   │ everything else         │ │
│  └─────────────────────────────┘   └─────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
           ▲                        ▲                          ▲
           │                        │                          │
     Admin Access          API Access              Public Visitors
     (Unrestricted)       (Order Processing)      (Maintenance Page)
```

---

## 📁 FILES CREATED/MODIFIED

### New Files
| Path | Purpose | Type |
|------|---------|------|
| `docker/nginx/maintenance.html` | Maintenance page HTML | New |
| `docker/nginx/snippets/maintenance.conf` | Nginx maintenance rules | New |

### Modified Files
| Path | Change | Type |
|------|--------|------|
| `docker/nginx/nginx.conf` | Include maintenance rules | Modify |

---

## 📝 STEP-BY-STEP IMPLEMENTATION

### Step 1: Create Maintenance HTML Page

**Location:** `docker/nginx/maintenance.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Under Maintenance - Aarya Clothing</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f8f9fa;
            color: #333;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            text-align: center;
            padding: 20px;
        }
        .maintenance-container {
            max-width: 600px;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .logo {
            width: 120px;
            margin-bottom: 24px;
        }
        h1 {
            font-size: 36px;
            color: #d946ef; /* Aarya purple/pink */
            margin-bottom: 16px;
        }
        p {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .apology {
            font-weight: bold;
            color: #555;
        }
        .resume-time {
            font-style: italic;
            color: #888;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="maintenance-container">
        <h1>AARYA CLOTHING</h1>
        <p class="apology">We apologize for the inconvenience.</p>
        <p>Our website is currently under maintenance to provide you with the best possible shopping experience.</p>
        <p class="resume-time">We will resume back soon. Thank you for your patience!</p>
    </div>
</body>
</html>
```

### Step 2: Create Maintenance Nginx Snippet

**Location:** `docker/nginx/snippets/maintenance.conf`

```nginx
# Maintenance Mode Configuration
# Set to "on" to enable maintenance mode, "off" to disable
set $maintenance_mode on;

# IP addresses that can bypass maintenance (optional)
# Useful for testing or giving specific access
map $remote_addr $is_allowed_ip {
    default 0;
    # Add IP addresses here (one per line) that should bypass maintenance
    # Example: 123.45.67.89 1;
}

# Check if request should bypass maintenance
map $request_uri $maintenance_bypass {
    default 0;
    
    # ===== ALWAYS ALLOWED =====
    # Auth routes - needed for admin login
    "^/auth/"                      1;
    "^/api/v1/auth/"             1;
    
    # Admin routes
    "^/admin/"                     1;
    "^/api/v1/admin/"            1;
    
    # All API v1 endpoints - needed for order processing
    "^/api/v1/"                  1;
    
    # Payment webhooks - critical for payment processing
    "^/api/payment/webhook"      1;
    "^/api/v1/webhooks/"         1;
    
    # Next.js static files - needed for admin dashboard to load
    "^/_next/"                   1;
    
    # Static assets
    "^/logo\.png$"               1;
    "^/favicon\.ico$"            1;
    
    # ACME challenge for SSL renewal
    "^/.well-known/acme-challenge/" 1;
    
    # Health checks
    "^/health$"                  1;
    "^/api/v1/health$"           1;
}

# Combine conditions: bypass if maintenance is off OR request is allowed
map $maintenance_mode$maintenance_bypass$is_allowed_ip $serve_maintenance {
    default      0;  # Don't serve maintenance
    "off00"      0;  # Maintenance off
    "off01"      0;  # Maintenance off
    "on000"      1;  # Maintenance on, not bypassed, not allowed IP
    "on001"      0;  # Maintenance on, not bypassed, but allowed IP
    "on100"      0;  # Maintenance on, bypassed by route
    "on101"      0;  # Maintenance on, bypassed by route + allowed IP
}
```

### Step 3: Modify Main Nginx Configuration

**Location:** `docker/nginx/nginx.conf`

**Find the `http` block and add this at the beginning:**

```nginx
http {
    # ==========================================
    # MAINTENANCE MODE INCLUSION
    # ==========================================
    include /etc/nginx/snippets/maintenance.conf;
    
    # ... rest of existing http config
```

**Then modify BOTH server blocks (HTTP:80 and HTTPS:443) to add maintenance check:**

Add this as the **FIRST location** in each server block:

```nginx
    # ==========================================
    # MAINTENANCE MODE HANDLER
    # Must be FIRST location block to catch all requests
    # ==========================================
    location / {
        if ($serve_maintenance = 1) {
            rewrite ^ /maintenance.html break;
        }
        
        # Existing proxy_pass logic for allowed routes
        proxy_pass http://$docker_upstream_frontend$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Serve maintenance page
    location = /maintenance.html {
        root /etc/nginx/html;
        internal;
    }
```

### Step 4: Verify Nginx Configuration

```bash
# Test nginx configuration
nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 5: Deploy Changes

```bash
# Rebuild nginx container
cd /opt/Aarya_clothing_frontend
docker compose build nginx

# Restart nginx only (no downtime for other services)
docker compose up -d --no-deps nginx

# Verify nginx logs
docker compose logs -f nginx
```

---

## 🎛️ CONTROLS

### Enable Maintenance Mode
Edit `docker/nginx/snippets/maintenance.conf`:
```nginx
set $maintenance_mode on;   # Change from "off" to "on"
```
Then restart nginx:
```bash
docker compose up -d --no-deps nginx
```

### Disable Maintenance Mode
Edit `docker/nginx/snippets/maintenance.conf`:
```nginx
set $maintenance_mode off;   # Change from "on" to "off"
```
Then restart nginx:
```bash
docker compose up -d --no-deps nginx
```

### Quick Toggle Script (Optional)

Create: `scripts/toggle_maintenance.sh`
```bash
#!/bin/bash

# Usage: ./toggle_maintenance.sh on|off

MODE=$1
if [ "$MODE" != "on" ] && [ "$MODE" != "off" ]; then
    echo "Usage: $0 on|off"
    exit 1
fi

# Update maintenance mode in config
sed -i "s/set \$maintenance_mode .*/set \$maintenance_mode $MODE;/" docker/nginx/snippets/maintenance.conf

# Restart nginx
docker compose up -d --no-deps nginx

echo "Maintenance mode set to: $MODE"
```

Make executable:
```bash
chmod +x scripts/toggle_maintenance.sh
```

---

## ✅ VERIFICATION

### Test Public Access (Should Show Maintenance)
```bash
# Test homepage
curl https://aaryaclothing.in/
# Expected: maintenance.html content

# Test product page
curl https://aaryaclothing.in/products
# Expected: maintenance.html content

# Test cart
curl https://aaryaclothing.in/cart
# Expected: maintenance.html content
```

### Test Admin Access (Should Work Normally)
```bash
# Test admin login page
curl https://aaryaclothing.in/auth/login
# Expected: 200 OK, login page HTML

# Test admin dashboard
curl https://aaryaclothing.in/admin
# Expected: 200 OK, admin dashboard

# Test API health
curl https://aaryaclothing.in/api/v1/health
# Expected: 200 OK, {"status":"ok"}

# Test orders API ( critical for admin)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     https://aaryaclothing.in/api/v1/orders
# Expected: 200 OK, orders list
```

### Test Payment Webhooks (Critical)
```bash
# Test Razorpay webhook
curl -X POST https://aaryaclothing.in/api/v1/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -d '{"test":"webhook"}'
# Expected: 200 OK (webhook processed)
```

---

## 🚨 TROUBLESHOOTING

### Issue: Maintenance page shows for admin routes
**Cause:** Missing pattern in bypass list  
**Fix:** Add the missing route to `maintenance.conf` bypass map

### Issue: Admin dashboard loads but APIs fail
**Cause:** API routes not in bypass list  
**Fix:** Add `/api/v1/*` to bypass map in maintenance.conf

### Issue: Nginx configuration error
**Cause:** Syntax error in nginx config  
**Fix:** Run `nginx -t` and check error message

### Issue: Changes not taking effect
**Cause:** Nginx container not restarted  
**Fix:** Run `docker compose up -d --no-deps nginx`

### Issue: Static assets (CSS/JS) not loading
**Cause:** `/_next/*` not in bypass list  
**Fix:** Ensure `/_next/` is in bypass map

---

## 📊 FLOW DIAGRAM

```
User Request
    ┌────────┴────────┐
    ▼                   ▼
┌─────────┐      ┌─────────────┐
│  Public  │      │   Admin/     │
│  Visitor │      │   APIs       │
└────┬────┘      └──────┬──────┘
     ▼                   ▼
┌─────────────────┐ ┌─────────────┐
│ Maintenance     │ │ Normal       │
│ HTML Page       │ │ Processing   │
└─────────────────┘ └─────────────┘
```

---

## 📅 MAINTENANCE WINDOW CHECKLIST

### Before Enabling Maintenance
- [ ] Notify admin team about maintenance window
- [ ] Ensure payment webhooks are in bypass list
- [ ] Test maintenance mode on staging (if available)
- [ ] Prepare maintenance message with accurate resume time
- [ ] Backup current nginx configuration

### During Maintenance
- [ ] Enable maintenance mode
- [ ] Verify public visitors see maintenance page
- [ ] Verify admin can login and process orders
- [ ] Monitor payment webhook logs
- [ ] Monitor API error rates

### After Maintenance
- [ ] Disable maintenance mode
- [ ] Verify all pages load normally
- [ ] Test checkout flow
- [ ] Verify payment processing works
- [ ] Clear any caches if needed

---

## 🔒 SECURITY CONSIDERATIONS

### What's Still Accessible During Maintenance
- All API endpoints (`/api/v1/*`)
- Admin dashboard (`/admin/*`)
- Auth endpoints (`/auth/*`)
- Payment webhooks (`/api/v1/webhooks/*`)

### What's Blocked
- All public-facing pages
- Product catalog
- Shopping cart (frontend)
- Checkout pages (frontend)
- All other routes not in bypass list

### Recommendations
1. **Rate Limiting Still Active**: Maintenance mode doesn't disable rate limiting
2. **Monitor Logs**: Watch for unusual activity during maintenance
3. **DDoS Protection**: Ensure your infrastructure protects against attacks
4. **SSL Maintained**: All connections remain HTTPS during maintenance

---

## 📈 MONITORING DURING MAINTENANCE

### Key Metrics to Watch
```bash
# Check nginx status
docker compose exec nginx nginx -t

# View nginx access logs
docker compose logs -f nginx

# Check API health
docker compose exec core curl -f http://localhost:5001/health
docker compose exec commerce curl -f http://localhost:5002/health
docker compose exec payment curl -f http://localhost:5003/health
docker compose exec admin curl -f http://localhost:5004/health

# View all container status
docker compose ps
```

### Expected Logs
```
# Public visitor accessing homepage:
192.168.1.100 - - [25/Apr/2025:10:00:00 +0000] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
# → Serves maintenance.html (200 OK)

# Admin accessing dashboard:
192.168.1.200 - - [25/Apr/2025:10:00:01 +0000] "GET /admin HTTP/1.1" 200 5678 "-" "Mozilla/5.0"
# → Proxied to frontend container (admin dashboard)

# Payment webhook:
203.0.113.45 - - [25/Apr/2025:10:00:02 +0000] "POST /api/v1/webhooks/razorpay HTTP/1.1" 200 123 "-" "-"
# → Proxied to payment container (webhook processed)
```

---

## 🎉 SUCCESS CRITERIA

Maintenance mode is **working correctly** when:

✅ Public visitors see maintenance message on all public pages  
✅ Admin can access `/auth/login` and login successfully  
✅ Admin can access `/admin` dashboard  
✅ Admin can view and process orders  
✅ Payment webhooks continue processing payments  
✅ All API endpoints respond normally  
✅ No 5xx errors in logs  
✅ No container restarts occurred  

---

## 📚 REFERENCES

- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [Nginx Map Module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
- [Nginx If Directives](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html#if)
- [Aarya Clothing Architecture](../ARCHITECTURE.md)

---

## 📝 CHANGE LOG

| Date | Author | Change | Version |
|------|--------|--------|---------|
| April 2025 | Aarya Team | Initial implementation | 1.0.0 |

---

**Document Location:** `docs/maintenance/WEBSITE_MAINTENANCE_MODE.md`
